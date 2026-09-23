// Shared shape for both Reports and Dashboards
export type PowerBiKind = "report" | "dashboard";

export type PowerBiItem = {
  id: string;
  kind: PowerBiKind;
  workspaceId: string;
  workspaceName: string;
  /** The raw name/displayName as it comes back from the Power BI API. */
  name: string;
  /** Extracted leading code, e.g. "DBK-STG-901" - empty string when the name doesn't match the standard pattern. */
  reportCode: string;
  /** The remainder of the name after the code (and its separator) is stripped - the full name when there was no code. */
  reportTitle: string;
  webUrl: string;
  /** Author-entered description, when the report has one. */
  description?: string;
  /** Last modified timestamp from Power BI / Fabric metadata (ISO string), when available. */
  lastModified?: string;
  /** Last published / refreshed timestamp (ISO string), when available. */
  lastPublish?: string;
  /** Name or email of the person who modified the item or is responsible/owner, when available. */
  responsibleUser?: string;
  /** Direct email of the responsible workspace owner / lead, when available. */
  responsibleEmail?: string;
};

export type PowerBiListResponse = {
  data: PowerBiItem[];
  meta: {
    workspaceCount: number;
    itemCount: number;
    codedCount: number;
    fetchedAt: string;
    skippedWorkspaces: { workspaceId: string; reason: string }[];
  };
};
