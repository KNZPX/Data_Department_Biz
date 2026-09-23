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
    const table = searchParams.get("table") || "";
    const type = searchParams.get("type") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const allItems = getDictionary();

    // Collect summary statistics
    const tablesSet = new Set<string>();
    let measureCount = 0;
    let dataColumnCount = 0;
    let calcColumnCount = 0;

    for (const item of allItems) {
      if (item.Table_Name) tablesSet.add(item.Table_Name);
      if (item.Object_Type === "Measure") measureCount++;
      else if (item.Object_Type === "Data Column") dataColumnCount++;
      else if (item.Object_Type === "Calculated Column") calcColumnCount++;
    }

    // Filter items
    let filtered = allItems;

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
          i.DAX_Formula.toLowerCase().includes(q)
        );
      });
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
        totalMeasures: measureCount,
        totalDataColumns: dataColumnCount,
        totalCalcColumns: calcColumnCount,
        totalTables: tablesSet.size,
        tables: Array.from(tablesSet).sort(),
      },
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
