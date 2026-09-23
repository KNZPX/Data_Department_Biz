import {
  getDbItems,
  upsertDbItems,
  getDbChangeLogs,
  insertDbChangeLogs,
  type ChangeLogEntry,
} from "./db";
import type { PowerBiItem, PowerBiKind } from "./powerbiTypes";

export type PowerBiChangeLogEntry = ChangeLogEntry;

/**
 * Synchronize fetched Power BI items with the database 'powerbi_items' table.
 * - If item is new: insert into powerbi_items without noise.
 * - If item has changed (new publish date, title, workspace, etc.): update and record diff in change_log.
 * - If item is identical: unchanged.
 */
export async function syncPowerBiItemsToDatabase(
  items: PowerBiItem[],
  kind: PowerBiKind = "report"
): Promise<{ added: number; updated: number; unchanged: number }> {
  if (!items || items.length === 0) return { added: 0, updated: 0, unchanged: 0 };

  const existingItems = await getDbItems(kind);
  const existingMap = new Map<string, PowerBiItem>();
  existingItems.forEach((row) => existingMap.set(row.id, row));

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toUpsert: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changeLogsToInsert: any[] = [];
  const nowIso = new Date().toISOString();

  for (const item of items) {
    const existing = existingMap.get(item.id);
    const publishTime = item.lastPublish || item.lastModified || null;

    const currentRecord = {
      id: item.id,
      kind: item.kind,
      workspace_id: item.workspaceId,
      workspace_name: item.workspaceName,
      name: item.name,
      report_code: item.reportCode || null,
      report_title: item.reportTitle || null,
      web_url: item.webUrl || null,
      description: item.description || null,
      last_modified: item.lastModified || null,
      last_publish: publishTime,
      responsible_user: item.responsibleUser || null,
      responsible_email: item.responsibleEmail || null,
      first_seen_at: publishTime || nowIso,
      last_seen_at: nowIso,
      updated_at: nowIso,
    };

    const publisher = item.responsibleUser || item.responsibleEmail || "Unspecified";
    const pubDateStr = publishTime
      ? new Date(publishTime).toLocaleString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    if (!existing) {
      toUpsert.push(currentRecord);
      added++;
    } else {
      const diffs: string[] = [];

      const oldPublish = existing.lastPublish ? new Date(existing.lastPublish).getTime() : null;
      const newPublish = publishTime ? new Date(publishTime).getTime() : null;
      const isNewPublish = oldPublish !== newPublish;

      if (isNewPublish) {
        diffs.push(`New Publish Version (${pubDateStr || "-"})`);
      }
      if ((existing.responsibleUser || "") !== (item.responsibleUser || "")) {
        diffs.push(`Responsible user changed to "${item.responsibleUser || "None"}"`);
      }
      if (existing.name !== item.name) {
        diffs.push(`Name changed to "${item.name}"`);
      }
      if (existing.workspaceName !== item.workspaceName) {
        diffs.push(`Moved to Workspace "${item.workspaceName}"`);
      }
      if ((existing.description || "") !== (item.description || "")) {
        diffs.push("Updated description");
      }

      if (diffs.length > 0) {
        toUpsert.push(currentRecord);
        const kindLabel = item.kind === "dashboard" ? "Dashboard" : "Report";
        const codePart = item.reportCode ? `[${item.reportCode}] ` : "";
        const actionTitle = isNewPublish ? `New Version Published` : `Updated ${kindLabel}`;

        changeLogsToInsert.push({
          entity_table: "powerbi_items",
          entity_id: item.id,
          action: "update",
          summary: `${actionTitle}: ${codePart}${item.name} (${diffs.join(", ")}) by ${publisher}`,
          before: existing,
          after: currentRecord,
          changed_by: publisher,
          changed_at: isNewPublish && publishTime ? publishTime : nowIso,
        });
        updated++;
      } else {
        unchanged++;
      }
    }
  }

  if (toUpsert.length > 0) {
    await upsertDbItems(toUpsert);
  }
  if (changeLogsToInsert.length > 0) {
    await insertDbChangeLogs(changeLogsToInsert);
  }

  return { added, updated, unchanged };
}

export async function getPowerBiChangeLogs(options?: { itemId?: string; limit?: number }) {
  return getDbChangeLogs(options);
}
