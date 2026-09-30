import { requireModule } from "@/lib/guard";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  failImport,
  finalizeImport,
  getDaxModels,
  getFingerprints,
  importItems,
  importStructure,
  startImport,
} from "@/lib/daxStore";
import { daxItemId, type BimItem, type BimRelationship, type BimTable } from "@/lib/bimModel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL_CODE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// GET ?model=PKT-D01 → fingerprints for the browser-side diff preview
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return bad("Sign in first.", 401);
  const model = (request.nextUrl.searchParams.get("model") || "").toUpperCase();
  if (!MODEL_CODE.test(model)) return bad("Unknown model code.");
  const [fingerprints, models] = await Promise.all([getFingerprints(model), getDaxModels()]);
  return Response.json({ fingerprints, model: models.find((m) => m.code === model) || null });
}

// POST { action: start | structure | items | finalize | fail, ... }
export async function POST(request: NextRequest) {
  const g = await requireModule("dax.import");
  if (g.deny) return g.deny;
  const user = await getCurrentUser();
  if (!user) return bad("Sign in first.", 401);
  const who = user.name;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Request body must be JSON.");
  }
  const action = String(body.action || "");
  const modelCode = String(body.modelCode || "").toUpperCase();
  if (!MODEL_CODE.test(modelCode)) return bad("Model code must look like PKT-D01.");

  try {
    if (action === "start") {
      const importId = await startImport({ modelCode, fileName: String(body.fileName || "model.bim"), user: who });
      return Response.json({ importId });
    }

    const importId = String(body.importId || "");
    if (!/^[0-9a-f-]{36}$/.test(importId)) return bad("Missing importId.");

    if (action === "structure") {
      const tables = (body.tables as BimTable[]) || [];
      const relationships = (body.relationships as BimRelationship[]) || [];
      if (tables.some((t) => t.modelCode !== modelCode || t.id !== daxItemId(modelCode, "tbl", t.name))) {
        return bad("Table ids don't match the model.");
      }
      await importStructure({ importId, tables, relationships: relationships.filter((r) => r.modelCode === modelCode) });
      return Response.json({ ok: true });
    }

    if (action === "items") {
      const items = (body.items as BimItem[]) || [];
      if (items.length > 500) return bad("Send at most 500 items per batch.");
      // Recompute ids server-side so a client can't write outside its model.
      for (const it of items) {
        const kind = it.itemType === "Measure" ? "ms" : "col";
        if (it.modelCode !== modelCode || it.id !== daxItemId(modelCode, kind, it.tableName, it.name)) {
          return bad(`Item id mismatch for ${it.tableName}[${it.name}].`);
        }
      }
      const result = await importItems({
        importId,
        modelCode,
        modelName: String(body.modelName || modelCode),
        items,
        user: who,
      });
      return Response.json(result);
    }

    if (action === "finalize") {
      const summary = await finalizeImport({
        importId,
        modelCode,
        modelName: String(body.modelName || modelCode),
        fileName: String(body.fileName || "model.bim"),
        compatibilityLevel: typeof body.compatibilityLevel === "number" ? body.compatibilityLevel : null,
        stats: body.stats as { tables: number; measures: number; columns: number; relationships: number },
        counts: body.counts as { created: number; changed: number; unchanged: number },
        user: who,
      });
      return Response.json({ summary });
    }

    if (action === "fail") {
      await failImport(importId, String(body.message || "Cancelled"));
      return Response.json({ ok: true });
    }

    return bad("Unknown action.");
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err);
    return bad(message, 500);
  }
}
