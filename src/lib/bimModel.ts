// Pure (browser + server) parser for Power BI / Tabular .bim files.
// Turns a 10 MB model.bim into a compact list of measures, columns, tables and
// relationships that can be sent to /api/dax/import in small batches.

export type BimItemType = "Measure" | "Data Column" | "Calculated Column" | "Calculated Table Column";

export type BimItem = {
  id: string;
  modelCode: string;
  tableName: string;
  name: string;
  itemType: BimItemType;
  dataType: string | null;
  expression: string | null;
  formatString: string | null;
  description: string | null;
  displayFolder: string | null;
  sourceColumn: string | null;
  isHidden: boolean;
  lineageTag: string | null;
};

export type BimTable = {
  id: string;
  modelCode: string;
  name: string;
  isHidden: boolean;
  sourceType: string | null;
  sourceExpression: string | null;
  description: string | null;
  measureCount: number;
  columnCount: number;
};

export type BimRelationship = {
  id: string;
  modelCode: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  crossFilter: string | null;
  isActive: boolean;
  fromCardinality: string | null;
  toCardinality: string | null;
};

export type ParsedBim = {
  modelCode: string;
  modelName: string;
  compatibilityLevel: number | null;
  items: BimItem[];
  tables: BimTable[];
  relationships: BimRelationship[];
  stats: { tables: number; measures: number; columns: number; relationships: number };
};

/** Same normalization the database fingerprint view uses. */
export function normalizeExpression(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const joined = Array.isArray(value) ? value.join("\n") : String(value);
  const out = joined.replace(/\r\n/g, "\n").trim();
  return out.length ? out : null;
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const SAFE = /[^a-zA-Z0-9_-]/g;

/**
 * Stable, readable id. Clean names keep the historical format
 * (`PKT-D01_ms_fact_x_measure`); names containing symbols such as `%` get a
 * short hash so `%rate` and `_rate` can no longer collide.
 */
export function daxItemId(modelCode: string, kind: "ms" | "col" | "tbl", tableName: string, name = ""): string {
  const raw = kind === "tbl" ? `${modelCode}_${kind}_${tableName}` : `${modelCode}_${kind}_${tableName}_${name}`;
  const safe = raw.replace(SAFE, "_");
  return safe === raw ? safe : `${safe}~${fnv1a(raw)}`;
}

const COLUMN_TYPES: Record<string, BimItemType | null> = {
  data: "Data Column",
  calculated: "Calculated Column",
  calculatedTableColumn: "Calculated Table Column",
  rowNumber: null, // internal engine column — not useful in a dictionary
};

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return Array.isArray(v) ? v.join("\n") : String(v);
}

type RawObj = Record<string, unknown>;

export function parseBim(text: string, modelCode: string, modelName?: string): ParsedBim {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let doc: RawObj;
  try {
    doc = JSON.parse(clean) as RawObj;
  } catch {
    throw new Error("This file is not a valid .bim (JSON) model.");
  }
  const model = doc.model as RawObj | undefined;
  if (!model || !Array.isArray(model.tables)) {
    throw new Error("No model.tables found — export the model as .bim from Tabular Editor or Power BI.");
  }

  const items: BimItem[] = [];
  const tables: BimTable[] = [];

  for (const t of model.tables as RawObj[]) {
    const tableName = String(t.name);
    const measures = (Array.isArray(t.measures) ? t.measures : []) as RawObj[];
    const columns = (Array.isArray(t.columns) ? t.columns : []) as RawObj[];
    const partitions = (Array.isArray(t.partitions) ? t.partitions : []) as RawObj[];
    const source = (partitions[0]?.source || {}) as RawObj;

    let columnCount = 0;
    for (const c of columns) {
      const mapped = COLUMN_TYPES[String(c.type || "data")];
      if (mapped === null) continue;
      const itemType: BimItemType = mapped ?? "Data Column";
      columnCount++;
      const name = String(c.name);
      items.push({
        id: daxItemId(modelCode, "col", tableName, name),
        modelCode,
        tableName,
        name,
        itemType,
        dataType: str(c.dataType),
        expression: normalizeExpression(c.expression),
        formatString: str(c.formatString),
        description: normalizeExpression(c.description),
        displayFolder: str(c.displayFolder),
        sourceColumn: str(c.sourceColumn),
        isHidden: Boolean(c.isHidden),
        lineageTag: str(c.lineageTag),
      });
    }

    for (const m of measures) {
      const name = String(m.name);
      items.push({
        id: daxItemId(modelCode, "ms", tableName, name),
        modelCode,
        tableName,
        name,
        itemType: "Measure",
        dataType: str(m.dataType),
        expression: normalizeExpression(m.expression),
        formatString: str(m.formatString),
        description: normalizeExpression(m.description),
        displayFolder: str(m.displayFolder),
        sourceColumn: null,
        isHidden: Boolean(m.isHidden),
        lineageTag: str(m.lineageTag),
      });
    }

    tables.push({
      id: daxItemId(modelCode, "tbl", tableName),
      modelCode,
      name: tableName,
      isHidden: Boolean(t.isHidden),
      sourceType: str(source.type),
      sourceExpression: normalizeExpression(source.expression),
      description: normalizeExpression(t.description),
      measureCount: measures.length,
      columnCount,
    });
  }

  const relationships: BimRelationship[] = ((Array.isArray(model.relationships) ? model.relationships : []) as RawObj[]).map(
    (r) => ({
      id: `${modelCode}_rel_${String(r.name || `${r.fromTable}.${r.fromColumn}-${r.toTable}.${r.toColumn}`)}`,
      modelCode,
      fromTable: String(r.fromTable),
      fromColumn: String(r.fromColumn),
      toTable: String(r.toTable),
      toColumn: String(r.toColumn),
      crossFilter: str(r.crossFilteringBehavior) || "oneDirection",
      isActive: r.isActive !== false,
      fromCardinality: str(r.fromCardinality) || "many",
      toCardinality: str(r.toCardinality) || "one",
    })
  );

  // Guard against true duplicates (same table + same name) — keep the first.
  const seen = new Set<string>();
  const uniqueItems = items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));

  return {
    modelCode,
    modelName: modelName || modelCode,
    compatibilityLevel: typeof doc.compatibilityLevel === "number" ? doc.compatibilityLevel : null,
    items: uniqueItems,
    tables,
    relationships,
    stats: {
      tables: tables.length,
      measures: uniqueItems.filter((i) => i.itemType === "Measure").length,
      columns: uniqueItems.filter((i) => i.itemType !== "Measure").length,
      relationships: relationships.length,
    },
  };
}

/** Guess the model code from a file name like "PKT-D01_Strategy.bim". */
export function guessModelCode(fileName: string): string | null {
  const m = fileName.toUpperCase().match(/PKT-?D0?(\d{1,2})/);
  return m ? `PKT-D${m[1].padStart(2, "0")}` : null;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
