// Server-only: reads the stored personal Power BI access token and talks to
// the Power BI REST API.
import { refreshAccessToken } from "./powerbiAuth";
import { getStoredPowerBiToken, saveOAuthTokens } from "./powerbiToken";
import { TARGET_WORKSPACE_ID_SET } from "./powerbiWorkspaces";
import type { PowerBiItem, PowerBiKind } from "./powerbiTypes";

const POWERBI_API = "https://api.powerbi.com/v1.0/myorg";

export class PowerBiTokenError extends Error {
  code: "token_missing" | "token_expired";
  constructor(code: "token_missing" | "token_expired", message: string) {
    super(message);
    this.name = "PowerBiTokenError";
    this.code = code;
  }
}

async function getAccessToken(): Promise<string> {
  const stored = await getStoredPowerBiToken();
  if (!stored) {
    throw new PowerBiTokenError("token_missing", "No Power BI access token has been saved yet.");
  }
  if (new Date(stored.expiresAt).getTime() - Date.now() >= 5_000) {
    return stored.accessToken;
  }
  if (stored.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(stored.refreshToken);
      const saved = await saveOAuthTokens(refreshed);
      return saved.accessToken;
    } catch {
      // Refresh token expired or revoked
    }
  }
  throw new PowerBiTokenError("token_expired", "The saved Power BI access token has expired.");
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return res.statusText;
  }
}

async function powerBiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${POWERBI_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await safeErrorText(res);
    if (res.status === 401) {
      throw new PowerBiTokenError("token_expired", `Power BI rejected the current token (401): ${detail}`);
    }
    throw new Error(`Power BI API ${path} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

type PowerBiGroup = { id: string; name: string };
type PowerBiReport = {
  id: string;
  name: string;
  webUrl: string;
  datasetId?: string;
  datasetWorkspaceId?: string;
  description?: string;
  modifiedDateTime?: string;
  modifiedBy?: string;
  isOwnedByMe?: boolean;
};
type PowerBiDataset = {
  id: string;
  name: string;
  configuredBy?: string;
  createdDate?: string;
};
type PowerBiDashboard = {
  id: string;
  displayName: string;
  webUrl: string;
  modifiedDateTime?: string;
  modifiedBy?: string;
  isOwnedByMe?: boolean;
};

const REPORT_CODE_PATTERN = /^([A-Z]{3,4}-[A-Z0-9]{2,4}-\d+(?:-\d+)?)/i;

export function parseReportName(rawName: string): { reportCode: string; reportTitle: string } {
  const name = (rawName || "").trim();
  const match = name.match(REPORT_CODE_PATTERN);
  if (!match) {
    return { reportCode: "", reportTitle: name };
  }
  const reportCode = (match[1] ?? "").toUpperCase();
  const rest = name.slice(match[0].length).replace(/^[\s\-_:–—]+/, "").trim();
  return { reportCode, reportTitle: rest || name };
}

export function decodeJwtUser(token: string): { name: string; email: string } | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = JSON.parse(json) as any;
    return {
      name: payload.name || payload.given_name || "",
      email: payload.upn || payload.unique_name || payload.email || "",
    };
  } catch {
    return null;
  }
}

type DevContact = { name: string; email?: string };

const KNOWN_REPORT_CONTACTS: Record<string, DevContact> = {
  "PKT-STG-009": { name: "Kanjana Panchaisri", email: "kanjana.pa@BDMS.CO.TH" },
  "PKT-STG-014": { name: "Kanjana Panchaisri", email: "kanjana.pa@BDMS.CO.TH" },
  "PKT-STG-034": { name: "Kanjana Panchaisri", email: "kanjana.pa@BDMS.CO.TH" },
};

const WORKSPACE_FETCH_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const current = nextIndex++;
      if (current >= items.length) return;
      const item = items[current];
      if (item === undefined) continue;
      results[current] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getTargetWorkspaces(token: string): Promise<{ workspaces: PowerBiGroup[]; skipped: { workspaceId: string; reason: string }[] }> {
  const { value: groups } = await powerBiGet<{ value: PowerBiGroup[] }>(token, "/groups?$top=5000");
  const byId = new Map(groups.map((g) => [g.id.toLowerCase(), g]));
  const workspaces: PowerBiGroup[] = [];
  const skipped: { workspaceId: string; reason: string }[] = [];
  for (const id of TARGET_WORKSPACE_ID_SET) {
    const group = byId.get(id);
    if (group) workspaces.push(group);
    else skipped.push({ workspaceId: id, reason: "Not visible to the signed-in account, or no longer exists" });
  }
  return { workspaces, skipped };
}

type PowerBiUser = {
  emailAddress?: string;
  displayName?: string;
  groupUserAccessRight?: string;
  identifier?: string;
  principalType?: string;
};

async function getWorkspaceUsers(token: string, workspaceId: string): Promise<PowerBiUser[]> {
  try {
    const res = await powerBiGet<{ value: PowerBiUser[] }>(token, `/groups/${workspaceId}/users`);
    return res.value || [];
  } catch {
    return [];
  }
}

async function getWorkspaceDatasets(token: string, workspaceId: string): Promise<PowerBiDataset[]> {
  try {
    const res = await powerBiGet<{ value: PowerBiDataset[] }>(token, `/groups/${workspaceId}/datasets`);
    return res.value || [];
  } catch {
    return [];
  }
}

type PowerBiImport = {
  id: string;
  name?: string;
  importState?: string;
  createdDateTime?: string;
  updatedDateTime?: string;
  reports?: { id: string; name: string }[];
  datasets?: { id: string; name: string }[];
};

async function getWorkspaceImports(token: string, workspaceId: string): Promise<PowerBiImport[]> {
  try {
    const res = await powerBiGet<{ value: PowerBiImport[] }>(token, `/groups/${workspaceId}/imports`);
    return res.value || [];
  } catch {
    return [];
  }
}

async function fetchItemsForKind(kind: PowerBiKind): Promise<{ items: PowerBiItem[]; workspaceCount: number; skipped: { workspaceId: string; reason: string }[] }> {
  const token = await getAccessToken();
  const { workspaces, skipped } = await getTargetWorkspaces(token);

  const perWorkspace = await mapWithConcurrency(workspaces, WORKSPACE_FETCH_CONCURRENCY, async (workspace) => {
    try {
      if (kind === "report") {
        const [reportsRes, users, datasets, imports] = await Promise.all([
          powerBiGet<{ value: PowerBiReport[] }>(token, `/groups/${workspace.id}/reports`),
          getWorkspaceUsers(token, workspace.id),
          getWorkspaceDatasets(token, workspace.id),
          getWorkspaceImports(token, workspace.id),
        ]);

        const datasetMap = new Map(datasets.map((ds) => [ds.id, ds]));

        const publishTimeByReportId = new Map<string, string>();
        const publishTimeByDatasetId = new Map<string, string>();

        for (const imp of imports) {
          const timestamp = imp.updatedDateTime || imp.createdDateTime;
          if (!timestamp) continue;

          if (Array.isArray(imp.reports)) {
            for (const r of imp.reports) {
              const prev = publishTimeByReportId.get(r.id);
              if (!prev || new Date(timestamp).getTime() > new Date(prev).getTime()) {
                publishTimeByReportId.set(r.id, timestamp);
              }
            }
          }

          if (Array.isArray(imp.datasets)) {
            for (const d of imp.datasets) {
              const prev = publishTimeByDatasetId.get(d.id);
              if (!prev || new Date(timestamp).getTime() > new Date(prev).getTime()) {
                publishTimeByDatasetId.set(d.id, timestamp);
              }
            }
          }
        }

        return reportsRes.value.map((report) => {
          const dataset = report.datasetId ? datasetMap.get(report.datasetId) : undefined;
          const lastPublished =
            publishTimeByReportId.get(report.id) ||
            (report.datasetId ? publishTimeByDatasetId.get(report.datasetId) : undefined) ||
            dataset?.createdDate ||
            report.modifiedDateTime;

          const { reportCode } = parseReportName(report.name);
          const knownContact = reportCode ? KNOWN_REPORT_CONTACTS[reportCode] : undefined;

          let reportContact = knownContact?.name || report.modifiedBy;
          let reportEmail = knownContact?.email;

          return toItem(
            "report",
            workspace,
            report.id,
            report.name,
            report.webUrl,
            report.description,
            lastPublished,
            reportContact,
            reportEmail,
          );
        });
      }

      const [dashboardsRes] = await Promise.all([
        powerBiGet<{ value: PowerBiDashboard[] }>(token, `/groups/${workspace.id}/dashboards`),
      ]);

      return dashboardsRes.value.map((dashboard) => {
        const { reportCode } = parseReportName(dashboard.displayName);
        const knownContact = reportCode ? KNOWN_REPORT_CONTACTS[reportCode] : undefined;

        return toItem(
          "dashboard",
          workspace,
          dashboard.id,
          dashboard.displayName,
          dashboard.webUrl,
          undefined,
          dashboard.modifiedDateTime,
          knownContact?.name || dashboard.modifiedBy,
          knownContact?.email,
        );
      });
    } catch (error) {
      if (error instanceof PowerBiTokenError) throw error;
      skipped.push({ workspaceId: workspace.id, reason: error instanceof Error ? error.message : "Unknown error" });
      return [] as PowerBiItem[];
    }
  });

  return { items: perWorkspace.flat(), workspaceCount: workspaces.length, skipped };
}

function toItem(
  kind: PowerBiKind,
  workspace: { id: string; name: string },
  id: string,
  name: string,
  webUrl: string,
  description?: string,
  lastModified?: string,
  responsibleUser?: string,
  responsibleEmail?: string,
): PowerBiItem {
  const { reportCode, reportTitle } = parseReportName(name);
  return {
    id,
    kind,
    workspaceId: workspace.id,
    workspaceName: workspace.name.trim(),
    name,
    reportCode,
    reportTitle,
    webUrl,
    description: description || undefined,
    lastModified: lastModified || undefined,
    lastPublish: lastModified || undefined,
    responsibleUser: responsibleUser || undefined,
    responsibleEmail: responsibleEmail || undefined,
  };
}

export async function getAllReports() {
  return fetchItemsForKind("report");
}

export async function getAllDashboards() {
  return fetchItemsForKind("dashboard");
}
