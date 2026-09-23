import { NextRequest, NextResponse } from "next/server";
import { executeDaxQuery } from "@/lib/powerbi";
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
    const q = (searchParams.get("q") || "").toLowerCase().trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    const store = loadModels();
    const activeModelKey = store[modelCode] ? modelCode : (store["PKT-D01"] ? "PKT-D01" : Object.keys(store)[0]);
    const activeModel = store[activeModelKey];

    if (!activeModel) {
      return NextResponse.json({
        items: [],
        meta: { total: 0, totalMeasures: 0, totalColumns: 0, tables: [] },
        models: [],
      });
    }

    // Build unified items list for this model
    const measures = (activeModel.measures || []).map((m: any) => ({
      id: String(m["[ID]"] || m["[Name]"]),
      name: m["[Name]"] || "Unnamed Measure",
      tableName: m["[Table]"] || "Unknown Table",
      type: "Measure",
      dataType: m["[DataType]"] || "Double",
      description: m["[Description]"] || "Standard calculation logic defined in semantic model.",
      expression: m["[Expression]"] || `CALCULATE([${m["[Name]"]}])`,
      formatString: m["[FormatString]"] || null,
      isHidden: Boolean(m["[IsHidden]"]),
      modelCode: activeModel.code,
      modelName: activeModel.name,
    }));

    const columns = (activeModel.columns || []).map((c: any) => ({
      id: String(c["[ID]"] || c["[Name]"]),
      name: c["[Name]"] || "Unnamed Column",
      tableName: c["[Table]"] || "Unknown Table",
      type: c["[Type]"] === "Calculated" ? "Calculated Column" : "Data Column",
      dataType: c["[DataType]"] || "String",
      description: c["[Description]"] || "Physical or calculated attribute in semantic table.",
      expression: c["[Expression]"] || null,
      formatString: c["[FormatString]"] || null,
      isHidden: Boolean(c["[IsHidden]"]),
      modelCode: activeModel.code,
      modelName: activeModel.name,
    }));

    // Collect all tables and global counts for active model
    const tablesSet = new Set<string>();
    measures.forEach((m) => tablesSet.add(m.tableName));
    columns.forEach((c) => tablesSet.add(c.tableName));

    let items: any[] = [];
    if (type === "measure" || type === "measures") {
      items = measures;
    } else if (type === "column" || type === "columns") {
      items = columns;
    } else {
      items = [...measures, ...columns];
    }

    // Filter by table
    if (table && table !== "all") {
      items = items.filter((i) => i.tableName.toLowerCase() === table);
    }

    // Filter by search query
    if (q) {
      items = items.filter((i) => {
        return (
          i.name.toLowerCase().includes(q) ||
          i.tableName.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.expression && i.expression.toLowerCase().includes(q))
        );
      });
    }

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

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
    const { datasetId, query } = body;

    if (!datasetId || !query) {
      return NextResponse.json(
        { error: "Both datasetId and query are required" },
        { status: 400 }
      );
    }

    const result = await executeDaxQuery(datasetId, query);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute DAX query via Power BI API" },
      { status: 500 }
    );
  }
}
