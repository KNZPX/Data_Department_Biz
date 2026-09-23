import { NextRequest, NextResponse } from "next/server";
import { executeDaxQuery } from "@/lib/powerbi";
import {
  getAllDaxAnnotations,
  getAllCustomDaxItems,
  saveDaxAnnotation,
  saveCustomDaxItem,
  deleteCustomDaxItem,
  logSystemActivity,
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
    const activeModelKey = store[modelCode] ? modelCode : (store["PKT-D01"] ? "PKT-D01" : Object.keys(store)[0]);
    const activeModel = store[activeModelKey];

    if (!activeModel) {
      return NextResponse.json({
        items: [],
        meta: { total: 0, totalMeasures: 0, totalColumns: 0, totalTables: 0, tables: [] },
        models: [],
      });
    }

    // Load saved database annotations and custom DAX
    const [annotationsMap, customDaxList] = (await Promise.all([
      getAllDaxAnnotations().catch(() => ({} as Record<string, any>)),
      getAllCustomDaxItems().catch(() => [] as any[]),
    ])) as [Record<string, any>, any[]];

    // Build unified measures list
    const measures = (activeModel.measures || []).map((m: any) => {
      const name = m["[Name]"] || "Unnamed Measure";
      const tableName = m["[Table]"] || "Unknown Table";
      const id = String(m["[ID]"] || `${activeModel.code}_ms_${tableName}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_"));
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
        modelCode: activeModel.code,
        modelName: activeModel.name,
        mathDefinition: saved?.mathDefinition || "",
        businessDefinition: saved?.businessDefinition || "",
        notes: saved?.notes || "",
        isCustom: false,
      };
    });

    // Build unified columns list (All column types: Data, Calculated, CalculatedTableColumn, RowNumber)
    const columns = (activeModel.columns || []).map((c: any) => {
      const name = c["[Name]"] || "Unnamed Column";
      const tableName = c["[Table]"] || "Unknown Table";
      const rawType = c["[Type]"] || "";
      let colType = "Data Column";
      if (rawType === "Calculated") colType = "Calculated Column";
      else if (rawType === "CalculatedTableColumn") colType = "Calculated Table Column";
      else if (rawType === "RowNumber") colType = "System Row Column";

      const id = String(c["[ID]"] || `${activeModel.code}_col_${tableName}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_"));
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
        modelCode: activeModel.code,
        modelName: activeModel.name,
        mathDefinition: saved?.mathDefinition || "",
        businessDefinition: saved?.businessDefinition || "",
        notes: saved?.notes || "",
        isCustom: false,
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
          dataType: "Custom",
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
        };
      });

    // Collect all tables across all items
    const tablesSet = new Set<string>();
    measures.forEach((m) => tablesSet.add(m.tableName));
    columns.forEach((c) => tablesSet.add(c.tableName));
    customItems.forEach((ci) => tablesSet.add(ci.tableName));

    // Filter by type
    let allItems: any[] = [];
    if (type === "measure" || type === "measures") {
      allItems = [...measures, ...customItems];
    } else if (type === "column" || type === "columns" || type === "data column") {
      allItems = columns.filter((c) => c.type === "Data Column");
    } else if (type === "calculated column" || type === "calc_column") {
      allItems = columns.filter((c) => c.type === "Calculated Column" || c.type === "Calculated Table Column");
    } else if (type === "custom" || type === "custom dax") {
      allItems = customItems;
    } else {
      allItems = [...measures, ...customItems, ...columns];
    }

    // Filter by table
    if (table && table !== "all") {
      allItems = allItems.filter((i) => i.tableName.toLowerCase() === table);
    }

    // Filter by search query (Partial vs Exact match)
    if (q) {
      if (searchMode === "exact") {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const exactRegex = new RegExp(`\\b${escaped}\\b`, "i");
        allItems = allItems.filter((i) => {
          return (
            exactRegex.test(i.name) ||
            exactRegex.test(i.tableName) ||
            (i.expression && exactRegex.test(i.expression)) ||
            (i.mathDefinition && exactRegex.test(i.mathDefinition)) ||
            (i.businessDefinition && exactRegex.test(i.businessDefinition))
          );
        });
      } else {
        const lowerQ = q.toLowerCase();
        allItems = allItems.filter((i) => {
          return (
            i.name.toLowerCase().includes(lowerQ) ||
            i.tableName.toLowerCase().includes(lowerQ) ||
            (i.expression && i.expression.toLowerCase().includes(lowerQ)) ||
            (i.mathDefinition && i.mathDefinition.toLowerCase().includes(lowerQ)) ||
            (i.businessDefinition && i.businessDefinition.toLowerCase().includes(lowerQ))
          );
        });
      }
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
      const { id, datasetId, tableName, name, expression, formatString, mathDefinition, businessDefinition, notes, user } = body;
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

    // 4. Default: Live Query Execution via Power BI REST API
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
