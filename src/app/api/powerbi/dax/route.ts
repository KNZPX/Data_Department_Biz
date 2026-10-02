import { requireModule } from "@/lib/guard";
import { NextRequest, NextResponse } from "next/server";
import { executeDaxQuery } from "@/lib/powerbi";
import {
  getAllDaxAnnotations,
  saveDaxAnnotation,
  saveCustomDaxItem,
  deleteCustomDaxItem,
  getSupabaseClient,
  getDaxEditState,
} from "@/lib/db";
import { getDaxModels, getDaxRows, invalidateDaxCache, type DaxModelRow, type DaxRow } from "@/lib/daxStore";
import { getCurrentUser } from "@/lib/session";
import { getCommentCounts, getReviewMap } from "@/lib/collab";

export const dynamic = "force-dynamic";

type DictItem = {
  id: string;
  name: string;
  tableName: string;
  type: string;
  dataType: string;
  description: string;
  expression: string | null;
  formatString: string | null;
  isHidden: boolean;
  modelCode: string;
  modelName: string;
  mathDefinition: string;
  businessDefinition: string;
  notes: string;
  isCustom: boolean;
  displayFolder?: string | null;
  createdBy?: string;
  sampleValues: unknown[] | null;
  matchReason?: string;
  /** When the team's text (or a custom formula) last changed, and by whom. */
  updatedAt: string | null;
  updatedBy: string | null;
  reviewStatus: "draft" | "reviewed";
  comments: number;
};

const sameTime = (a?: string | null, b?: string | null) => (a ? new Date(a).getTime() : 0) === (b ? new Date(b).getTime() : 0);

async function resolveDatasetId(code: string): Promise<string> {
  const models = await getDaxModels().catch(() => [] as DaxModelRow[]);
  const hit = models.find((m) => m.code === code.toUpperCase());
  return hit?.dataset_id || code;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelCode = (searchParams.get("model") || "PKT-D01").toUpperCase();
    const type = (searchParams.get("type") || "all").toLowerCase();
    const table = (searchParams.get("table") || "all").toLowerCase();
    const q = (searchParams.get("q") || "").trim();
    const searchMode = (searchParams.get("searchMode") || "partial").toLowerCase();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(500, parseInt(searchParams.get("limit") || "150", 10));
    // "missing" = no business definition yet, "documented" = has one.
    const doc = (searchParams.get("doc") || "all").toLowerCase();
    const onlyId = searchParams.get("id");

    // Single source of truth: Supabase (kept current by .bim imports)
    const [rows, modelRows, annotationsMap, reviewMap, commentCounts] = await Promise.all([
      getDaxRows(),
      getDaxModels(),
      getAllDaxAnnotations().catch(() => ({} as Record<string, any>)),
      getReviewMap().catch(() => ({} as Record<string, string>)),
      getCommentCounts().catch(() => ({} as Record<string, number>)),
    ]);

    const isAllModels = modelCode === "ALL";
    const known = new Set(modelRows.map((m) => m.code));
    const activeCode = isAllModels ? "ALL" : known.has(modelCode) ? modelCode : modelRows[0]?.code || "PKT-D01";
    const activeRow = modelRows.find((m) => m.code === activeCode);
    const activeModel = {
      code: activeCode,
      name: isAllModels ? "All Semantic Models" : activeRow?.name || activeCode,
      id: isAllModels ? "all-models" : activeRow?.dataset_id || activeCode,
    };
    const nameOf = (code: string) => modelRows.find((m) => m.code === code)?.name || code;

    const inScope = rows.filter((r) => isAllModels || r.model_code === activeCode);

    const toItem = (r: DaxRow): DictItem => {
      const saved = annotationsMap[r.id];
      return {
        id: r.id,
        name: r.name,
        tableName: r.table_name,
        type: r.is_custom ? "Custom DAX" : r.item_type,
        dataType: r.data_type || (r.item_type === "Measure" ? "Double" : "String"),
        description: r.description || "",
        expression: r.expression || null,
        formatString: r.format_string || null,
        isHidden: Boolean(r.is_hidden),
        modelCode: r.model_code,
        modelName: r.model_name || nameOf(r.model_code),
        mathDefinition: r.math_definition || saved?.mathDefinition || "",
        businessDefinition: r.business_definition || saved?.businessDefinition || "",
        notes: r.notes || saved?.notes || "",
        isCustom: Boolean(r.is_custom),
        displayFolder: r.display_folder,
        sampleValues: (r.sample_values as unknown[] | null) || null,
        updatedAt: r.is_custom ? r.updated_at : saved?.updatedAt || null,
        updatedBy: r.is_custom ? null : saved?.updatedBy || null,
        reviewStatus: reviewMap[r.id] === "reviewed" ? "reviewed" : "draft",
        comments: commentCounts[r.id] || 0,
      };
    };

    // A single item by id, for shared links.
    if (onlyId) {
      const row = rows.find((r) => r.id === onlyId);
      return NextResponse.json({ items: row ? [toItem(row)] : [] });
    }

    const measures = inScope.filter((r) => !r.is_custom && r.item_type === "Measure").map(toItem);
    const columns = inScope.filter((r) => !r.is_custom && r.item_type !== "Measure").map(toItem);
    const customItems = rows
      .filter((r) => r.is_custom && (isAllModels || r.model_code === activeCode || r.model_code === "ALL"))
      .map(toItem);

    // Collect all tables across all items
    const tablesSet = new Set<string>();
    measures.forEach((m) => tablesSet.add(m.tableName));
    columns.forEach((c) => tablesSet.add(c.tableName));
    customItems.forEach((ci) => tablesSet.add(ci.tableName));

    // Filter by type (including Semantic Model and Custom by User)
    let allItems: DictItem[] = [];
    if (type === "semantic" || type === "semantic_model") {
      allItems = [...measures, ...columns];
    } else if (type === "custom" || type === "custom_by_user" || type === "custom dax") {
      allItems = customItems;
    } else if (type === "measure" || type === "measures") {
      allItems = [...measures, ...customItems];
    } else if (type === "column" || type === "columns" || type === "data column") {
      allItems = columns.filter((c) => c.type === "Data Column");
    } else if (type === "calculated column" || type === "calc_column") {
      allItems = columns.filter((c) => c.type === "Calculated Column" || c.type === "Calculated Table Column");
    } else {
      allItems = [...measures, ...customItems, ...columns];
    }

    const hasDefinition = (i: DictItem) => Boolean(i.businessDefinition.trim());
    // Documentation coverage for the current type scope (before the doc/table filters).
    const coverage = { documented: allItems.filter(hasDefinition).length, total: allItems.length };
    if (doc === "missing") allItems = allItems.filter((i) => !hasDefinition(i));
    else if (doc === "documented") allItems = allItems.filter(hasDefinition);

    // Filter by search query with relevance ranking (Name matches prioritized over formula/descriptions)
    if (q) {
      const lowerQ = q.toLowerCase();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`\\b${escaped}\\b`, "i");

      const scoredItems: { item: DictItem; score: number; matchReason?: string }[] = [];

      for (const it of allItems) {
        let score = 0;
        let matchReason = "";

        const nameLower = it.name.toLowerCase();
        const tableLower = it.tableName.toLowerCase();
        const exprLower = it.expression ? it.expression.toLowerCase() : "";
        const defLower = ((it.mathDefinition || "") + " " + (it.businessDefinition || "")).toLowerCase();

        // 1. Exact name match
        if (nameLower === lowerQ) {
          score += 1000;
          matchReason = "Exact Name Match";
        } else if (nameLower.startsWith(lowerQ) || nameLower.startsWith(`_${lowerQ}`) || nameLower.startsWith(`%${lowerQ}`)) {
          score += 800;
          matchReason = "Name Prefix Match";
        } else if (nameLower.includes(lowerQ)) {
          score += 500;
          matchReason = "Name Match";
        }

        // 2. Table match
        if (tableLower === lowerQ) {
          score += 300;
          if (!matchReason) matchReason = "Table Match";
        } else if (tableLower.includes(lowerQ)) {
          score += 150;
          if (!matchReason) matchReason = "Table Match";
        }

        // 3. Expression match
        if (exprLower.includes(lowerQ)) {
          // If searchMode is exact, must match word boundary
          if (searchMode === "exact") {
            if (wordRegex.test(it.expression || "")) {
              score += 100;
              if (!matchReason) matchReason = "Formula Reference";
            }
          } else {
            score += 100;
            if (!matchReason) matchReason = "Formula Reference";
          }
        }

        // 4. Definitions / notes match
        if (defLower.includes(lowerQ)) {
          score += 50;
          if (!matchReason) matchReason = "Definition Match";
        }

        if (score > 0) {
          scoredItems.push({ item: { ...it, matchReason }, score });
        }
      }

      // Sort by score descending (highest relevance first)
      scoredItems.sort((a, b) => b.score - a.score);
      allItems = scoredItems.map((s) => s.item);
    }

    // Per-table counts for the current type/doc/search (ignoring the table filter itself).
    const tableCounts: Record<string, number> = {};
    for (const i of allItems) tableCounts[i.tableName] = (tableCounts[i.tableName] || 0) + 1;

    // Filter by table
    if (table && table !== "all") {
      allItems = allItems.filter((i) => i.tableName.toLowerCase() === table);
    }

    const total = allItems.length;
    const startIndex = (page - 1) * limit;
    const paginated = allItems.slice(startIndex, startIndex + limit);

    // Live counts per model straight from the dictionary
    const documented = (r: DaxRow) => Boolean((r.business_definition || annotationsMap[r.id]?.businessDefinition || "").trim());
    const modelsMeta = modelRows.map((m) => {
      const own = rows.filter((r) => r.model_code === m.code && !r.is_custom);
      const ownMeasures = own.filter((r) => r.item_type === "Measure");
      return {
        code: m.code,
        name: m.name,
        id: m.dataset_id || m.code,
        totalMeasures: ownMeasures.length,
        documentedMeasures: ownMeasures.filter(documented).length,
        totalColumns: own.filter((r) => r.item_type !== "Measure").length,
        totalTables: m.table_count || new Set(own.map((r) => r.table_name)).size,
        totalRelationships: m.relationship_count || 0,
        lastImportedAt: m.last_imported_at,
        lastImportedBy: m.last_imported_by,
        sourceFile: m.source_file,
      };
    });

    return NextResponse.json({
      items: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalMeasures: measures.length,
        totalColumns: columns.length,
        totalSemantic: measures.length + columns.length,
        totalCustom: customItems.length,
        totalTables: tablesSet.size,
        tables: Array.from(tablesSet).sort(),
        tableCounts,
        coverage,
        activeModelCode: activeModel.code,
        activeModelName: activeModel.name,
        activeModelId: activeModel.id,
      },
      models: modelsMeta,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    if (action === "save_annotation" || action === "save_custom" || action === "delete_custom") {
      const g = await requireModule("dax.edit");
      if (g.deny) return g.deny;
    }
    // Audit identity always comes from the signed-in session, not the request body.
    const sessionUser = await getCurrentUser();
    const actor = sessionUser?.name || body.user || "Analyst";

    // 1. Save Math / Business Definitions
    if (action === "save_annotation") {
      const { id, mathDefinition, businessDefinition, notes, modelCode, tableName, objectName, objectType, baseUpdatedAt, force } = body;
      if (!id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

      // Someone else saved this item after the caller loaded it: don't overwrite silently.
      if (!force) {
        const state = await getDaxEditState(id);
        if (state.annotation && !sameTime(state.annotation.updatedAt, baseUpdatedAt)) {
          return NextResponse.json({ error: "conflict", conflict: state.annotation }, { status: 409 });
        }
      }

      const updatedAt = await saveDaxAnnotation({
        id,
        mathDefinition,
        businessDefinition,
        notes,
        modelCode,
        tableName,
        objectName,
        objectType,
        changedBy: actor,
      });

      invalidateDaxCache();
      return NextResponse.json({ success: true, updatedAt, updatedBy: actor, message: "Definition saved successfully" });
    }

    // 2. Save Custom DAX Measure
    if (action === "save_custom") {
      const { id, datasetId, tableName, name, expression, formatString, dataType, mathDefinition, businessDefinition, notes, baseUpdatedAt, force } = body;
      if (!name || !expression) {
        return NextResponse.json({ error: "Name and Expression are required" }, { status: 400 });
      }

      // Editing an existing team measure that someone else changed meanwhile.
      if (id && !force) {
        const state = await getDaxEditState(id);
        if (state.row?.isCustom && !sameTime(state.row.updatedAt, baseUpdatedAt)) {
          return NextResponse.json({ error: "conflict", conflict: { updatedAt: state.row.updatedAt, updatedBy: null, name: state.row.name, expression: state.row.expression } }, { status: 409 });
        }
      }

      const customId = id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const updatedAt = await saveCustomDaxItem({
        id: customId,
        datasetId: datasetId || "PKT-D01",
        tableName: tableName || "Custom Measures",
        name: name.trim(),
        expression: expression.trim(),
        formatString: formatString || null,
        dataType: dataType || "Decimal",
        itemType: "custom_dax",
        mathDefinition,
        businessDefinition,
        notes,
        createdBy: actor,
      });

      invalidateDaxCache();
      return NextResponse.json({ success: true, id: customId, updatedAt, updatedBy: actor, message: "Custom DAX measure saved" });
    }

    // 3. Delete Custom DAX Measure
    if (action === "delete_custom") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

      await deleteCustomDaxItem(id, actor);
      invalidateDaxCache();
      return NextResponse.json({ success: true, message: "Custom DAX measure deleted" });
    }

    // 4. Fetch Live Column Samples from Semantic Model (5-10 samples)
    if (action === "fetch_column_samples") {
      const { datasetId, tableName, columnName, itemId } = body;
      if (!datasetId || !tableName || !columnName) {
        return NextResponse.json(
          { error: "datasetId, tableName, and columnName are required" },
          { status: 400 }
        );
      }

      // Resolve dataset ID to actual GUID if model code was passed
      const resolvedDatasetId = /^[0-9a-f-]{36}$/i.test(datasetId) ? datasetId : await resolveDatasetId(datasetId);

      // Safely escape DAX identifiers
      const cleanTable = tableName.replace(/^'|'$/g, "").replace(/'/g, "''");
      const cleanCol = columnName.replace(/^\[|\]$/g, "").replace(/]/g, "]]");
      const sampleQuery = `EVALUATE TOPN(8, VALUES('${cleanTable}'[${cleanCol}]))`;

      let values: any[] = [];
      try {
        const queryResult = await executeDaxQuery(resolvedDatasetId, sampleQuery);
        const rows = queryResult?.results?.[0]?.tables?.[0]?.rows || [];
        values = rows
          .map((r: Record<string, any>) => Object.values(r)[0])
          .filter((v: any) => v !== undefined && v !== null && v !== "");
      } catch (err: any) {
        // Fallback for calculated tables or single columns
        try {
          const fallbackQuery = `EVALUATE TOPN(8, SELECTCOLUMNS('${cleanTable}', "val", '${cleanTable}'[${cleanCol}]))`;
          const queryResult = await executeDaxQuery(resolvedDatasetId, fallbackQuery);
          const rows = queryResult?.results?.[0]?.tables?.[0]?.rows || [];
          values = rows
            .map((r: Record<string, any>) => Object.values(r)[0])
            .filter((v: any) => v !== undefined && v !== null && v !== "");
        } catch (innerErr: any) {
          return NextResponse.json({
            success: false,
            error: "Sampling is not supported for this column type (e.g., system RowNumber, binary, or restricted table).",
            values: [],
          });
        }
      }

      // Slice to 5-10 distinct values
      const distinctValues = Array.from(new Set(values)).slice(0, 10);

      if (itemId && distinctValues.length > 0) {
        try {
          const supabase = getSupabaseClient();
          await supabase
            .from("dax_dictionary_items")
            .update({ sample_values: distinctValues, updated_at: new Date().toISOString() })
            .eq("id", itemId);
          invalidateDaxCache();
        } catch (dbErr) {
          console.error("Failed to persist sample values to Supabase:", dbErr);
        }
      }

      return NextResponse.json({ success: true, values: distinctValues });
    }

    // 5. Default: Live Query Execution via Power BI REST API
    const { datasetId, query } = body;
    if (!datasetId || !query) {
      return NextResponse.json(
        { error: "Both datasetId and query are required for live execution" },
        { status: 400 }
      );
    }

    const result = await executeDaxQuery(datasetId, query);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process DAX request" },
      { status: 500 }
    );
  }
}
