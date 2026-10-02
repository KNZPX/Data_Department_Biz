// Server-only: the DAX dictionary now lives in Supabase (dax_dictionary_items),
// fed by .bim imports, instead of a static JSON file bundled with the app.
import { getSupabaseClient, insertDbChangeLogs } from "./db";
import { onFormulasChanged } from "./collab";
import { normalizeExpression, type BimItem, type BimRelationship, type BimTable } from "./bimModel";

export type DaxRow = {
  id: string;
  model_code: string;
  model_name: string | null;
  table_name: string;
  name: string;
  item_type: string;
  data_type: string | null;
  expression: string | null;
  format_string: string | null;
  description: string | null;
  math_definition: string | null;
  business_definition: string | null;
  notes: string | null;
  is_custom: boolean;
  is_hidden: boolean;
  sample_values: unknown[] | null;
  display_folder: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DaxModelRow = {
  code: string;
  name: string;
  dataset_id: string | null;
  table_count: number | null;
  measure_count: number | null;
  column_count: number | null;
  relationship_count: number | null;
  last_imported_at: string | null;
  last_imported_by: string | null;
  source_file: string | null;
};

const ROW_COLUMNS =
  "id, model_code, model_name, table_name, name, item_type, data_type, expression, format_string, description, math_definition, business_definition, notes, is_custom, is_hidden, sample_values, display_folder, created_at, updated_at";

// Small in-memory cache per serverless instance; invalidated by imports and edits.
let cache: { at: number; rows: DaxRow[] } | null = null;
const CACHE_MS = 30_000;

export function invalidateDaxCache() {
  cache = null;
}

async function fetchAllRows(): Promise<DaxRow[]> {
  const supabase = getSupabaseClient();
  const page = 1000;
  const out: DaxRow[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("dax_dictionary_items")
      .select(ROW_COLUMNS)
      .eq("is_deleted", false)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data || []) as DaxRow[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function getDaxRows(): Promise<DaxRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await fetchAllRows();
  cache = { at: Date.now(), rows };
  return rows;
}

export async function getDaxModels(): Promise<DaxModelRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("dax_models").select("*").order("code");
  if (error) throw error;
  return (data || []) as DaxModelRow[];
}

// ----------------------------------------------------------------------------
// Import engine (called in batches from /api/dax/import)
// ----------------------------------------------------------------------------

export async function startImport(opts: { modelCode: string; fileName: string; user: string }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("dax_imports")
    .insert({ model_code: opts.modelCode, file_name: opts.fileName, imported_by: opts.user, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Fingerprints used by the browser to preview what an import will change. */
export async function getFingerprints(modelCode: string) {
  const supabase = getSupabaseClient();
  const out: { id: string; item_type: string; table_name: string; name: string; exp_hash: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("dax_items_fingerprint")
      .select("id, item_type, table_name, name, exp_hash")
      .eq("model_code", modelCode)
      .eq("is_custom", false)
      .eq("is_deleted", false)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function legacyId(id: string) {
  const i = id.indexOf("~");
  return i === -1 ? null : id.slice(0, i);
}

export async function importItems(opts: {
  importId: string;
  modelCode: string;
  modelName: string;
  items: BimItem[];
  user: string;
}) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const ids = opts.items.map((i) => i.id);
  const legacyIds = opts.items.map((i) => legacyId(i.id)).filter((x): x is string => Boolean(x));

  // Look up current state in chunks (keeps the REST URL short).
  const existing = new Map<string, { expression: string | null; name: string }>();
  const lookup = [...ids, ...legacyIds];
  for (let i = 0; i < lookup.length; i += 80) {
    const chunk = lookup.slice(i, i + 80);
    const { data, error } = await supabase
      .from("dax_dictionary_items")
      .select("id, name, expression")
      .in("id", chunk);
    if (error) throw error;
    for (const r of data || []) existing.set(r.id, { expression: r.expression, name: r.name });
  }

  let created = 0;
  let changed = 0;
  let unchanged = 0;
  const logs: Record<string, unknown>[] = [];

  for (const it of opts.items) {
    // Fall back to the pre-hash id only when it really is the same object (same name);
    // `%rate` and `_rate` used to collide on one id.
    const legacy = legacyId(it.id);
    const legacyRow = legacy ? existing.get(legacy) : undefined;
    const prev = existing.get(it.id) || (legacyRow && legacyRow.name === it.name ? legacyRow : undefined);
    const before = normalizeExpression(prev?.expression);
    if (!prev) {
      created++;
      if (it.itemType === "Measure") {
        logs.push({
          id: crypto.randomUUID(),
          entity_table: "dax_dictionary_items",
          entity_id: it.id,
          action: "create",
          summary: `New measure [${it.name}] in ${it.tableName} (${opts.modelCode})`,
          changed_by: opts.user,
          changed_at: now,
          before: null,
          after: { expression: it.expression, table: it.tableName, name: it.name },
        });
      }
    } else if (before !== it.expression) {
      changed++;
      logs.push({
        id: crypto.randomUUID(),
        entity_table: "dax_dictionary_items",
        entity_id: it.id,
        action: "update",
        summary: `Formula changed: [${it.name}] in ${it.tableName} (${opts.modelCode})`,
        changed_by: opts.user,
        changed_at: now,
        before: { expression: before },
        after: { expression: it.expression },
      });
    } else {
      unchanged++;
    }
  }

  // Upsert only model-owned columns — analyst notes, definitions and sample
  // values on existing rows are left untouched.
  const rows = opts.items.map((it) => ({
    id: it.id,
    model_code: opts.modelCode,
    model_name: opts.modelName,
    table_name: it.tableName,
    name: it.name,
    item_type: it.itemType,
    data_type: it.dataType,
    expression: it.expression,
    format_string: it.formatString,
    description: it.description,
    display_folder: it.displayFolder,
    source_column: it.sourceColumn,
    lineage_tag: it.lineageTag,
    is_hidden: it.isHidden,
    is_custom: false,
    is_deleted: false,
    deleted_at: null,
    last_import_id: opts.importId,
    last_imported_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from("dax_dictionary_items").upsert(rows, { onConflict: "id" });
  if (error) throw error;

  if (logs.length) await insertDbChangeLogs(logs);
  invalidateDaxCache();
  // Watchers hear about changed formulas; reviewed items go back to draft.
  const changedItems = logs
    .filter((l) => l.action === "update")
    .map((l) => ({ id: String(l.entity_id), name: opts.items.find((i) => i.id === l.entity_id)?.name || String(l.entity_id), modelCode: opts.modelCode }));
  await onFormulasChanged(changedItems, opts.user).catch((e) => console.error("Couldn't notify watchers", e));
  return { created, changed, unchanged };
}

export async function importStructure(opts: {
  importId: string;
  tables: BimTable[];
  relationships: BimRelationship[];
}) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  if (opts.tables.length) {
    const { error } = await supabase.from("dax_model_tables").upsert(
      opts.tables.map((t) => ({
        id: t.id,
        model_code: t.modelCode,
        name: t.name,
        is_hidden: t.isHidden,
        source_type: t.sourceType,
        source_expression: t.sourceExpression,
        description: t.description,
        measure_count: t.measureCount,
        column_count: t.columnCount,
        is_deleted: false,
        last_import_id: opts.importId,
        updated_at: now,
      })),
      { onConflict: "id" }
    );
    if (error) throw error;
  }
  if (opts.relationships.length) {
    const { error } = await supabase.from("dax_model_relationships").upsert(
      opts.relationships.map((r) => ({
        id: r.id,
        model_code: r.modelCode,
        from_table: r.fromTable,
        from_column: r.fromColumn,
        to_table: r.toTable,
        to_column: r.toColumn,
        cross_filter: r.crossFilter,
        is_active: r.isActive,
        from_cardinality: r.fromCardinality,
        to_cardinality: r.toCardinality,
        is_deleted: false,
        last_import_id: opts.importId,
        updated_at: now,
      })),
      { onConflict: "id" }
    );
    if (error) throw error;
  }
}

export async function finalizeImport(opts: {
  importId: string;
  modelCode: string;
  modelName: string;
  fileName: string;
  compatibilityLevel: number | null;
  stats: { tables: number; measures: number; columns: number; relationships: number };
  counts: { created: number; changed: number; unchanged: number };
  user: string;
}) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const notThisImport = `last_import_id.is.null,last_import_id.neq.${opts.importId}`;

  // Anything that belongs to this model but wasn't in the file is retired (soft delete).
  const { data: removed, error: remErr } = await supabase
    .from("dax_dictionary_items")
    .update({ is_deleted: true, deleted_at: now })
    .eq("model_code", opts.modelCode)
    .eq("is_custom", false)
    .eq("is_deleted", false)
    .or(notThisImport)
    .select("id, name, table_name, item_type");
  if (remErr) throw remErr;

  for (const table of ["dax_model_tables", "dax_model_relationships"]) {
    const { error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq("model_code", opts.modelCode)
      .eq("is_deleted", false)
      .or(notThisImport);
    if (error) throw error;
  }

  const removedMeasures = (removed || []).filter((r) => r.item_type === "Measure");
  const summary = {
    ...opts.counts,
    removed: (removed || []).length,
    removedMeasures: removedMeasures.map((r) => `${r.table_name}[${r.name}]`),
    stats: opts.stats,
  };

  const { error: modelErr } = await supabase.from("dax_models").upsert(
    {
      code: opts.modelCode,
      name: opts.modelName,
      compatibility_level: opts.compatibilityLevel,
      table_count: opts.stats.tables,
      measure_count: opts.stats.measures,
      column_count: opts.stats.columns,
      relationship_count: opts.stats.relationships,
      last_import_id: opts.importId,
      last_imported_at: now,
      last_imported_by: opts.user,
      source_file: opts.fileName,
      updated_at: now,
    },
    { onConflict: "code" }
  );
  if (modelErr) throw modelErr;

  await supabase
    .from("dax_imports")
    .update({ status: "done", summary, finished_at: now })
    .eq("id", opts.importId);

  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "dax_models",
      entity_id: opts.modelCode,
      action: "import",
      summary: `Imported ${opts.fileName} into ${opts.modelCode}: ${opts.counts.changed} changed, ${opts.counts.created} new, ${summary.removed} removed`,
      changed_by: opts.user,
      changed_at: now,
      before: null,
      after: summary,
    },
  ]);

  invalidateDaxCache();
  return summary;
}

export async function failImport(importId: string, message: string) {
  const supabase = getSupabaseClient();
  await supabase
    .from("dax_imports")
    .update({ status: "failed", summary: { error: message }, finished_at: new Date().toISOString() })
    .eq("id", importId);
}
