import { NextRequest, NextResponse } from "next/server";
import { executeDaxQuery } from "@/lib/powerbi";
import {
  getAllDaxAnnotations,
  getAllCustomDaxItems,
  saveDaxAnnotation,
  saveCustomDaxItem,
  deleteCustomDaxItem,
  logSystemActivity,
  getSupabaseClient,
} from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface SemanticModelStore {
  [key: string]: {
    id: string;
    code: string;
    name: string;
    measures: any[];
    columns: any[];
  };
}

let cachedModels: SemanticModelStore | null = null;

function loadModels(): SemanticModelStore {
  if (cachedModels) return cachedModels;
  try {
    const filePath = path.join(process.cwd(), "src/data/d01_d02_dictionary.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedModels = JSON.parse(raw);
      return cachedModels || {};
    }
  } catch (err) {
    console.error("Error reading d01_d02_dictionary.json:", err);
  }
  return {};
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
    const limit = parseInt(searchParams.get("limit") || "150", 10);

    const store = loadModels();
    const isAllModels = modelCode === "ALL";
    const activeModelKey = isAllModels
      ? "ALL"
      : store[modelCode]
      ? modelCode
      : store["PKT-D01"]
      ? "PKT-D01"
      : Object.keys(store)[0];
    const activeModel = isAllModels
      ? {
          code: "ALL",
          name: "All Semantic Models",
          id: "all-models",
          measures: Object.values(store).flatMap((m: any) => m.measures || []),
          columns: Object.values(store).flatMap((m: any) => m.columns || []),
        }
      : store[activeModelKey];

    if (!activeModel && !isAllModels) {
      return NextResponse.json({
        items: [],
        meta: { total: 0, totalMeasures: 0, totalColumns: 0, totalTables: 0, tables: [] },
        models: [],
      });
    }

    // Load saved database annotations, custom DAX, and sample values from Supabase
    const [annotationsMap, customDaxList, sampleValuesMap] = (await Promise.all([
      getAllDaxAnnotations().catch(() => ({} as Record<string, any>)),
      getAllCustomDaxItems().catch(() => [] as any[]),
      (async () => {
        try {
          const supabase = getSupabaseClient();
          const { data } = await supabase
            .from("dax_dictionary_items")
            .select("id, sample_values")
            .not("sample_values", "is", null);
          const map: Record<string, any[]> = {};
          if (data) {
            for (const r of data) {
              if (r.sample_values) map[r.id] = r.sample_values;
            }
          }
          return map;
        } catch {
          return {};
        }
      })(),
    ])) as [Record<string, any>, any[], Record<string, any[]>];

    // Build unified measures list
    const rawMeasures = isAllModels
      ? Object.entries(store).flatMap(([k, m]: [string, any]) =>
          (m.measures || []).map((meas: any) => ({ ...meas, _modelCode: m.code, _modelName: m.name }))
        )
      : (activeModel.measures || []).map((meas: any) => ({
          ...meas,
          _modelCode: activeModel.code,
          _modelName: activeModel.name,
        }));

    const measures = rawMeasures.map((m: any) => {
      const name = m["[Name]"] || "Unnamed Measure";
      const tableName = m["[Table]"] || "Unknown Table";
      const mCode = m._modelCode || activeModel.code;
      const mName = m._modelName || activeModel.name;
      const id = String(m["[ID]"] || `${mCode}_ms_${tableName}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_"));
      const saved = annotationsMap[id];

      return {
        id,
        name,
        tableName,
        type: "Measure",
        dataType: m["[DataType]"] || "Double",
        description: m["[Description]"] || "Standard calculation logic defined in semantic model.",
        expression: m["[Expression]"] || `CALCULATE([${name}])`,
        formatString: m["[FormatString]"] || null,
        isHidden: Boolean(m["[IsHidden]"]),
        modelCode: mCode,
        modelName: mName,
        mathDefinition: saved?.mathDefinition || "",
        businessDefinition: saved?.businessDefinition || "",
        notes: saved?.notes || m["[Notes]"] || "",
        isCustom: false,
        sampleValues: sampleValuesMap[id] || null,
      };
    });

    // Build unified columns list (All column types: Data, Calculated, CalculatedTableColumn, RowNumber)
    const rawColumns = isAllModels
      ? Object.entries(store).flatMap(([k, m]: [string, any]) =>
          (m.columns || []).map((col: any) => ({ ...col, _modelCode: m.code, _modelName: m.name }))
        )
      : (activeModel.columns || []).map((col: any) => ({
          ...col,
          _modelCode: activeModel.code,
          _modelName: activeModel.name,
        }));

    const columns = rawColumns.map((c: any) => {
      const name = c["[Name]"] || "Unnamed Column";
      const tableName = c["[Table]"] || "Unknown Table";
      const mCode = c._modelCode || activeModel.code;
      const mName = c._modelName || activeModel.name;
      const rawType = c["[Type]"] || "";
      let colType = "Data Column";
      if (rawType === "Calculated") colType = "Calculated Column";
      else if (rawType === "CalculatedTableColumn") colType = "Calculated Table Column";
      else if (rawType === "RowNumber") colType = "System Row Column";

      const id = String(c["[ID]"] || `${mCode}_col_${tableName}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_"));
      const saved = annotationsMap[id];

      return {
        id,
        name,
        tableName,
        type: colType,
        dataType: c["[DataType]"] || "String",
        description: c["[Description]"] || "Column attribute in semantic model table.",
        expression: c["[Expression]"] || null,
        formatString: c["[FormatString]"] || null,
        isHidden: Boolean(c["[IsHidden]"]),
        modelCode: mCode,
        modelName: mName,
        mathDefinition: saved?.mathDefinition || "",
        businessDefinition: saved?.businessDefinition || "",
        notes: saved?.notes || c["[Notes]"] || "",
        isCustom: false,
        sampleValues: sampleValuesMap[id] || null,
      };
    });

    // Custom DAX items for this model or global
    const customItems = customDaxList
      .filter((c) => !c.datasetId || c.datasetId === activeModel.code || c.datasetId === "ALL")
      .map((c) => {
        const saved = annotationsMap[c.id];
        return {
          id: c.id,
          name: c.name,
          tableName: c.tableName,
          type: "Custom DAX",
          dataType: c.dataType || "Custom",
          description: "Manually registered calculation measure.",
          expression: c.expression,
          formatString: c.formatString || null,
          isHidden: false,
          modelCode: activeModel.code,
          modelName: activeModel.name,
          mathDefinition: c.mathDefinition || saved?.mathDefinition || "",
          businessDefinition: c.businessDefinition || saved?.businessDefinition || "",
          notes: c.notes || saved?.notes || "",
          isCustom: true,
          createdBy: c.createdBy,
          sampleValues: sampleValuesMap[c.id] || null,
        };
      });

    // Collect all tables across all items
    const tablesSet = new Set<string>();
    measures.forEach((m) => tablesSet.add(m.tableName));
    columns.forEach((c) => tablesSet.add(c.tableName));
    customItems.forEach((ci) => tablesSet.add(ci.tableName));

    // Filter by type (including Semantic Model and Custom by User)
    let allItems: any[] = [];
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

    // Filter by table
    if (table && table !== "all") {
      allItems = allItems.filter((i) => i.tableName.toLowerCase() === table);
    }

    // Filter by search query with relevance ranking (Name matches prioritized over formula/descriptions)
    if (q) {
      const lowerQ = q.toLowerCase();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`\\b${escaped}\\b`, "i");

      const scoredItems: { item: any; score: number; matchReason?: string }[] = [];

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

    const total = allItems.length;
    const startIndex = (page - 1) * limit;
    const paginated = allItems.slice(startIndex, startIndex + limit);

    // Metadata for the available models
    const modelsMeta = Object.keys(store).map((k) => {
      const m = store[k];
      return {
        code: m.code,
        name: m.name,
        id: m.id,
        totalMeasures: (m.measures || []).length,
        totalColumns: (m.columns || []).length,
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

    // 1. Save Math / Business Definitions
    if (action === "save_annotation") {
      const { id, mathDefinition, businessDefinition, notes, user } = body;
      if (!id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

      await saveDaxAnnotation({
        id,
        mathDefinition,
        businessDefinition,
        notes,
        changedBy: user || "Analyst",
      });

      return NextResponse.json({ success: true, message: "Definition saved successfully" });
    }

    // 2. Save Custom DAX Measure
    if (action === "save_custom") {
      const { id, datasetId, tableName, name, expression, formatString, dataType, mathDefinition, businessDefinition, notes, user } = body;
      if (!name || !expression) {
        return NextResponse.json({ error: "Name and Expression are required" }, { status: 400 });
      }

      const customId = id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await saveCustomDaxItem({
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
        createdBy: user || "Analyst",
      });

      return NextResponse.json({ success: true, id: customId, message: "Custom DAX measure created" });
    }

    // 3. Delete Custom DAX Measure
    if (action === "delete_custom") {
      const { id, user } = body;
      if (!id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

      await deleteCustomDaxItem(id, user || "Analyst");
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
      const store = loadModels();
      let resolvedDatasetId = datasetId;
      if (store[datasetId]?.id) {
        resolvedDatasetId = store[datasetId].id;
      } else if (datasetId.toUpperCase().includes("D01")) {
        resolvedDatasetId = store["PKT-D01"]?.id || "aa345483-35dc-4a57-a3a8-b09dffeb39e0";
      } else if (datasetId.toUpperCase().includes("D02")) {
        resolvedDatasetId = store["PKT-D02"]?.id || "e78dfd10-e9b6-45ac-a74d-14a1f5d1b7fc";
      }

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
