import { NextRequest, NextResponse } from "next/server";
import { executeDaxQuery, getAllDatasets } from "@/lib/powerbi";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface DictionaryItem {
  Table_Name: string;
  Object_Name: string;
  Description: string;
  Definition: string;
  Object_Type: string;
  DAX_Formula: string;
  Status: string;
  Semantic_Model?: string;
}

let cachedDictionary: DictionaryItem[] | null = null;

function getDictionary(): DictionaryItem[] {
  if (cachedDictionary) return cachedDictionary;
  try {
    const filePath = path.join(process.cwd(), "src/data/measure_dictionary.json");
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      cachedDictionary = JSON.parse(data);
      return cachedDictionary || [];
    }
  } catch (err) {
    console.error("Error reading measure_dictionary.json:", err);
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").toLowerCase().trim();
    const model = searchParams.get("model") || "";
    const table = searchParams.get("table") || "";
    const type = searchParams.get("type") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    const allItems = getDictionary();

    // Group items by Semantic Model
    const modelStatsMap = new Map<string, {
      name: string;
      total: number;
      measures: number;
      columns: number;
      tables: Set<string>;
    }>();

    for (const item of allItems) {
      const mName = item.Semantic_Model || "Hospital Master Core Dimensions";
      if (!modelStatsMap.has(mName)) {
        modelStatsMap.set(mName, {
          name: mName,
          total: 0,
          measures: 0,
          columns: 0,
          tables: new Set(),
        });
      }
      const st = modelStatsMap.get(mName)!;
      st.total++;
      if (item.Object_Type === "Measure") st.measures++;
      else st.columns++;
      if (item.Table_Name) st.tables.add(item.Table_Name);
    }

    const semanticModels = Array.from(modelStatsMap.values()).map((st) => ({
      name: st.name,
      total: st.total,
      measures: st.measures,
      columns: st.columns,
      tableCount: st.tables.size,
    })).sort((a, b) => b.total - a.total);

    // Filter items
    let filtered = allItems;

    if (model && model !== "all") {
      filtered = filtered.filter((i) => (i.Semantic_Model || "").toLowerCase() === model.toLowerCase());
    }

    if (table && table !== "all") {
      filtered = filtered.filter((i) => i.Table_Name.toLowerCase() === table.toLowerCase());
    }

    if (type && type !== "all") {
      filtered = filtered.filter((i) => i.Object_Type.toLowerCase() === type.toLowerCase());
    }

    if (q) {
      filtered = filtered.filter((i) => {
        return (
          i.Object_Name.toLowerCase().includes(q) ||
          i.Table_Name.toLowerCase().includes(q) ||
          i.Description.toLowerCase().includes(q) ||
          i.Definition.toLowerCase().includes(q) ||
          i.DAX_Formula.toLowerCase().includes(q) ||
          (i.Semantic_Model && i.Semantic_Model.toLowerCase().includes(q))
        );
      });
    }

    // Collect filtered table names
    const filteredTablesSet = new Set<string>();
    let filteredMeasures = 0;
    let filteredColumns = 0;

    for (const item of filtered) {
      if (item.Table_Name) filteredTablesSet.add(item.Table_Name);
      if (item.Object_Type === "Measure") filteredMeasures++;
      else filteredColumns++;
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Also fetch available datasets from Power BI API (optional)
    let datasets: any[] = [];
    try {
      datasets = await getAllDatasets();
    } catch {}

    return NextResponse.json({
      items: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalMeasures: filteredMeasures,
        totalColumns: filteredColumns,
        totalTables: filteredTablesSet.size,
        tables: Array.from(filteredTablesSet).sort(),
      },
      semanticModels,
      datasets,
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
