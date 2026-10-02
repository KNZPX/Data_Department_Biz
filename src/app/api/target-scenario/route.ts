import { requireModule } from "@/lib/guard";
import { NextRequest, NextResponse } from "next/server";
import {
  getDbTargetScenarios,
  saveDbTargetScenario,
  deleteDbTargetScenario,
} from "@/lib/db";
import {
  TARGET_META,
  TARGET_UNITS,
  TARGET_PLAN_BASE,
  TARGET_PLAN_MARKET_BASE,
  TARGET_REF_BASE,
  TARGET_REF_MKT_BASE,
  TARGET_DIG_BASE,
  TARGET_DIG_MKT_BASE,
  TARGET_MED_BASE,
  TARGET_MED_MKT_BASE,
  TARGET_NH_BASE,
  TARGET_NH_MONTH,
  VERIFIED_BASE_CASE,
  EMBEDDED_SCENARIOS,
  TARGET_SITES,
} from "@/data/targetScenarioData";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeKey = searchParams.get("storeKey");

    const scenarios = await getDbTargetScenarios();

    const filtered = storeKey
      ? scenarios.filter((s) => s.store_key === storeKey)
      : scenarios;

    // The planner only needs the saved scenarios; skip the large baseline payload.
    if (searchParams.get("only") === "scenarios") {
      return NextResponse.json({ success: true, scenarios: filtered });
    }

    return NextResponse.json({
      success: true,
      meta: TARGET_META,
      sites: TARGET_SITES,
      units: TARGET_UNITS,
      baseCase: VERIFIED_BASE_CASE,
      embeddedScenarios: EMBEDDED_SCENARIOS,
      strategicBases: {
        plan: TARGET_PLAN_BASE,
        planMarket: TARGET_PLAN_MARKET_BASE,
        ref: TARGET_REF_BASE,
        refMarket: TARGET_REF_MKT_BASE,
        dig: TARGET_DIG_BASE,
        digMarket: TARGET_DIG_MKT_BASE,
        med: TARGET_MED_BASE,
        medMarket: TARGET_MED_MKT_BASE,
        nh: TARGET_NH_BASE,
        nhMonth: TARGET_NH_MONTH,
      },
      scenarios: filtered,
    });
  } catch (error: any) {
    console.error("GET /api/target-scenario error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load target scenarios" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const _g = await requireModule("target.edit");
  if (_g.deny) return _g.deny;
  try {
    const body = await req.json();
    const { id, store_key, store_label, name, saved_at_label, sort_order, snapshot, baseUpdatedAt, force } = body;
    const created_by = _g.user.name || _g.user.email;

    // Saving over an existing scenario: stop if someone else saved it after we loaded it.
    if (id && !force) {
      const current = (await getDbTargetScenarios()).find((s) => s.id === id);
      if (current && baseUpdatedAt && new Date(current.updated_at).getTime() !== new Date(baseUpdatedAt).getTime()) {
        return NextResponse.json(
          { success: false, error: "conflict", conflict: { updatedAt: current.updated_at, updatedBy: current.created_by, name: current.name } },
          { status: 409 }
        );
      }
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Scenario name is required" },
        { status: 400 }
      );
    }

    const saved = await saveDbTargetScenario({
      id,
      store_key,
      store_label,
      name,
      saved_at_label,
      sort_order,
      snapshot,
      created_by,
    });

    return NextResponse.json({
      success: true,
      scenario: saved,
      message: `Scenario "${name}" saved to Supabase successfully`,
    });
  } catch (error: any) {
    console.error("POST /api/target-scenario error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save scenario" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const _g = await requireModule("target.edit");
  if (_g.deny) return _g.deny;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Scenario ID is required" },
        { status: 400 }
      );
    }

    await deleteDbTargetScenario(id, _g.user.name || _g.user.email);

    return NextResponse.json({
      success: true,
      message: "Scenario deleted from Supabase",
    });
  } catch (error: any) {
    console.error("DELETE /api/target-scenario error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete scenario" },
      { status: 500 }
    );
  }
}
