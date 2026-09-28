// ==============================================================================
// BDMS Phuket 2027 Hierarchical Cascading Target Engine
// Hierarchy: PKT (Central HQ) -> Site (BPK, BSI, DBK) -> COE/SBU -> Setting (OPD/IPD) -> Market (Thai/Expat/Fly-in)
// ==============================================================================

import {
  TARGET_UNITS,
  TARGET_SITES,
  HOSPITAL_PROFILES,
  VERIFIED_BASE_CASE,
  UnitRecord,
} from "@/data/targetScenarioData";

export type TargetMethod = "growth_pct" | "fixed_amount" | "increment_amount" | "portion_share";

export type HierarchyLevel = "pkt" | "site" | "coe" | "setting" | "market";

export interface TargetTreeNode {
  id: string; // Unique path e.g. "PKT", "BPK", "BPK||CoE Trauma", "BPK||CoE Trauma||OPD", "BPK||CoE Trauma||OPD||Thai"
  level: HierarchyLevel;
  name: string;
  code: string;
  site: string; // "PKT" | "BPK" | "BSI" | "DBK (Premium)"
  group?: string; // "CoE" | "SBU" | "Hospital Focus" | "Usual Business"
  parentKey?: string;
  childrenKeys: string[];

  // Baseline data (2026 Base & 2025 Prior)
  baseRev26: number; // THB
  priorRev25: number; // THB
  baseVisits26: number;
  priorVisits25: number;

  // Configuration for target calculation
  method: TargetMethod;
  inputVal: number; // e.g. 10.0 for 10%, 5000 for 5000 MB, 60 for 60% portion
  unitType: "MB" | "pct" | "THB";
  isOverridden: boolean;

  // Computed 2027 targets
  targetRev27: number;
  targetVisits27: number;
  growthRevPct: number;
  growthVisitsPct: number;

  // Delegation & Reconciliation metrics
  delegatedChildrenRev: number;
  allocationGap: number; // targetRev27 - delegatedChildrenRev
  allocationStatus: "balanced" | "under_allocated" | "over_allocated";
}

// Default ratios for Care Setting (OPD vs IPD) by specialty group
const DEFAULT_OPD_RATIOS: Record<string, number> = {
  "CoE Trauma": 0.45,
  "CoE Cardiovascular": 0.40,
  "CoE Neurology": 0.50,
  "CoE Orthopedic": 0.45,
  "CoE Cancer": 0.35,
  "SBU Women's Health": 0.60,
  "SBU Child": 0.80,
  "SBU PPSI": 0.55,
  "SBU Wellness": 0.90,
  "Elective Surgery": 0.30,
  "NCDs Focus": 0.85,
  "Usual Business": 0.65,
};

// Default Market Segment ratios (Thai, Expat, Fly-in) by Hospital
const DEFAULT_SITE_MARKET_RATIOS: Record<string, { Thai: number; Expat: number; "Fly-in": number }> = {
  BPK: { Thai: 0.48, Expat: 0.24, "Fly-in": 0.28 },
  BSI: { Thai: 0.52, Expat: 0.20, "Fly-in": 0.28 },
  "DBK (Premium)": { Thai: 0.70, Expat: 0.18, "Fly-in": 0.12 },
  DBK: { Thai: 0.70, Expat: 0.18, "Fly-in": 0.12 },
};

/**
 * Build initial 5-level hierarchical tree from baseline data
 */
export function buildInitialTargetTree(): Record<string, TargetTreeNode> {
  const tree: Record<string, TargetTreeNode> = {};

  // 1. Level 0: PKT (Central Network HQ)
  let pktBaseRev26 = 0;
  let pktPriorRev25 = 0;
  let pktBaseVisits26 = 0;
  let pktPriorVisits25 = 0;

  TARGET_UNITS.forEach((u) => {
    pktBaseRev26 += u.base_rev;
    pktBaseVisits26 += u.base_visit;
    u.months.forEach((m) => {
      pktPriorRev25 += m.rev25 || 0;
      pktPriorVisits25 += m.visit25 || 0;
    });
  });

  const pktSiteChildren = ["BPK", "BSI", "DBK (Premium)"];
  tree["PKT"] = {
    id: "PKT",
    level: "pkt",
    name: "BDMS Phuket Network (ส่วนกลาง 3 โรง)",
    code: "PKT",
    site: "PKT",
    childrenKeys: pktSiteChildren,
    baseRev26: pktBaseRev26,
    priorRev25: pktPriorRev25,
    baseVisits26: pktBaseVisits26,
    priorVisits25: pktPriorVisits25,
    method: "growth_pct",
    inputVal: 10.70, // Default base case growth ~ +10.7%
    unitType: "pct",
    isOverridden: false,
    targetRev27: pktBaseRev26 * 1.107,
    targetVisits27: pktBaseVisits26 * 1.054,
    growthRevPct: 10.70,
    growthVisitsPct: 5.4,
    delegatedChildrenRev: 0,
    allocationGap: 0,
    allocationStatus: "balanced",
  };

  // 2. Level 1: Sites (BPK, BSI, DBK)
  pktSiteChildren.forEach((site) => {
    const siteUnits = TARGET_UNITS.filter((u) => u.site === site);
    let sBaseRev = 0;
    let sPriorRev = 0;
    let sBaseVisits = 0;
    let sPriorVisits = 0;

    siteUnits.forEach((u) => {
      sBaseRev += u.base_rev;
      sBaseVisits += u.base_visit;
      u.months.forEach((m) => {
        sPriorRev += m.rev25 || 0;
        sPriorVisits += m.visit25 || 0;
      });
    });

    const coeChildren = siteUnits.map((u) => `${site}||${u.coe}`);
    const defaultSiteGrowth = site === "BPK" ? 8.93 : site === "BSI" ? 10.92 : 38.20;

    tree[site] = {
      id: site,
      level: "site",
      name: HOSPITAL_PROFILES[site]?.fullName || site,
      code: site,
      site,
      parentKey: "PKT",
      childrenKeys: coeChildren,
      baseRev26: sBaseRev,
      priorRev25: sPriorRev,
      baseVisits26: sBaseVisits,
      priorVisits25: sPriorVisits,
      method: "growth_pct",
      inputVal: defaultSiteGrowth,
      unitType: "pct",
      isOverridden: false,
      targetRev27: sBaseRev * (1 + defaultSiteGrowth / 100),
      targetVisits27: sBaseVisits * (1 + (defaultSiteGrowth * 0.5) / 100),
      growthRevPct: defaultSiteGrowth,
      growthVisitsPct: defaultSiteGrowth * 0.5,
      delegatedChildrenRev: 0,
      allocationGap: 0,
      allocationStatus: "balanced",
    };

    // 3. Level 2: COE / SBU Units
    siteUnits.forEach((u) => {
      const coeKey = `${site}||${u.coe}`;
      const settingChildren = [`${coeKey}||OPD`, `${coeKey}||IPD`];

      // Prior year rev & visits from monthly data
      let uPriorRev = 0;
      let uPriorVisits = 0;
      u.months.forEach((m) => {
        uPriorRev += m.rev25 || 0;
        uPriorVisits += m.visit25 || 0;
      });

      // Default growth from verified base case
      const verifiedGrowth =
        VERIFIED_BASE_CASE?.snap?.rev?.unit?.[coeKey]?.value !== undefined
          ? parseFloat(VERIFIED_BASE_CASE.snap.rev.unit[coeKey].value)
          : defaultSiteGrowth;

      const coeTargetRev = u.base_rev * (1 + verifiedGrowth / 100);
      const coeTargetVisits = u.base_visit * (1 + (verifiedGrowth * 0.55) / 100);

      tree[coeKey] = {
        id: coeKey,
        level: "coe",
        name: u.coe,
        code: u.coe,
        site,
        group: u.group,
        parentKey: site,
        childrenKeys: settingChildren,
        baseRev26: u.base_rev,
        priorRev25: uPriorRev || u.base_rev * 0.9,
        baseVisits26: u.base_visit,
        priorVisits25: uPriorVisits || u.base_visit * 0.95,
        method: "growth_pct",
        inputVal: verifiedGrowth,
        unitType: "pct",
        isOverridden: false,
        targetRev27: coeTargetRev,
        targetVisits27: coeTargetVisits,
        growthRevPct: verifiedGrowth,
        growthVisitsPct: verifiedGrowth * 0.55,
        delegatedChildrenRev: 0,
        allocationGap: 0,
        allocationStatus: "balanced",
      };

      // 4. Level 3: Care Setting (OPD vs IPD)
      const opdRatio = DEFAULT_OPD_RATIOS[u.coe] ?? 0.55;
      const ipdRatio = 1 - opdRatio;

      ["OPD", "IPD"].forEach((setting) => {
        const settingKey = `${coeKey}||${setting}`;
        const ratio = setting === "OPD" ? opdRatio : ipdRatio;
        const setBaseRev = u.base_rev * ratio;
        const setPriorRev = (uPriorRev || u.base_rev * 0.9) * ratio;
        const setBaseVisits = u.base_visit * (setting === "OPD" ? 0.85 : 0.15); // OPD has far more visits
        const setPriorVisits = setBaseVisits * 0.95;

        const setTargetRev = coeTargetRev * ratio;
        const setTargetVisits = coeTargetVisits * (setting === "OPD" ? 0.85 : 0.15);

        const marketChildren = [
          `${settingKey}||Thai`,
          `${settingKey}||Expat`,
          `${settingKey}||Fly-in`,
        ];

        tree[settingKey] = {
          id: settingKey,
          level: "setting",
          name: `${u.coe} (${setting})`,
          code: setting,
          site,
          group: u.group,
          parentKey: coeKey,
          childrenKeys: marketChildren,
          baseRev26: setBaseRev,
          priorRev25: setPriorRev,
          baseVisits26: setBaseVisits,
          priorVisits25: setPriorVisits,
          method: "growth_pct",
          inputVal: verifiedGrowth,
          unitType: "pct",
          isOverridden: false,
          targetRev27: setTargetRev,
          targetVisits27: setTargetVisits,
          growthRevPct: verifiedGrowth,
          growthVisitsPct: verifiedGrowth * 0.55,
          delegatedChildrenRev: 0,
          allocationGap: 0,
          allocationStatus: "balanced",
        };

        // 5. Level 4: Market Segments (Thai, Expat, Fly-in)
        const siteMktRatios = DEFAULT_SITE_MARKET_RATIOS[site] || DEFAULT_SITE_MARKET_RATIOS.BPK;

        ["Thai", "Expat", "Fly-in"].forEach((mkt) => {
          const mktKey = `${settingKey}||${mkt}`;
          const mktRatio = (siteMktRatios as any)[mkt] || 0.33;

          const mktBaseRev = setBaseRev * mktRatio;
          const mktPriorRev = setPriorRev * mktRatio;
          const mktBaseVisits = setBaseVisits * mktRatio;
          const mktPriorVisits = setPriorVisits * mktRatio;

          const mktTargetRev = setTargetRev * mktRatio;
          const mktTargetVisits = setTargetVisits * mktRatio;

          tree[mktKey] = {
            id: mktKey,
            level: "market",
            name: `${setting} - ${mkt}`,
            code: mkt,
            site,
            group: u.group,
            parentKey: settingKey,
            childrenKeys: [],
            baseRev26: mktBaseRev,
            priorRev25: mktPriorRev,
            baseVisits26: mktBaseVisits,
            priorVisits25: mktPriorVisits,
            method: "growth_pct",
            inputVal: verifiedGrowth,
            unitType: "pct",
            isOverridden: false,
            targetRev27: mktTargetRev,
            targetVisits27: mktTargetVisits,
            growthRevPct: verifiedGrowth,
            growthVisitsPct: verifiedGrowth * 0.55,
            delegatedChildrenRev: 0,
            allocationGap: 0,
            allocationStatus: "balanced",
          };
        });
      });
    });
  });

  // Reconcile and calculate gaps
  return recalculateTargetTree(tree);
}

/**
 * Compute single node target based on its method and inputVal
 */
export function calculateNodeTarget(
  node: TargetTreeNode,
  parentTargetRev?: number
): { targetRev: number; targetVisits: number; growthRevPct: number } {
  let targetRev = node.baseRev26;
  const input = node.inputVal || 0;

  switch (node.method) {
    case "growth_pct":
      targetRev = node.baseRev26 * (1 + input / 100);
      break;
    case "fixed_amount":
      // Input entered in Millions THB (MB)
      targetRev = input * 1_000_000;
      break;
    case "increment_amount":
      // Increment in MB added to 2026 base
      targetRev = node.baseRev26 + input * 1_000_000;
      break;
    case "portion_share":
      // Percent of parent target
      if (parentTargetRev && parentTargetRev > 0) {
        targetRev = parentTargetRev * (input / 100);
      } else {
        targetRev = node.baseRev26;
      }
      break;
  }

  const growthRevPct = node.baseRev26 > 0 ? ((targetRev - node.baseRev26) / node.baseRev26) * 100 : 0;
  const visitGrowth = Math.max(-20, growthRevPct * 0.55);
  const targetVisits = node.baseVisits26 * (1 + visitGrowth / 100);

  return { targetRev, targetVisits, growthRevPct };
}

/**
 * Recalculate tree bottom-up or top-down and update reconciliation gaps
 */
export function recalculateTargetTree(
  tree: Record<string, TargetTreeNode>
): Record<string, TargetTreeNode> {
  const updated: Record<string, TargetTreeNode> = { ...tree };

  // First pass: compute leaf nodes (Market Level 4)
  Object.values(updated)
    .filter((n) => n.level === "market")
    .forEach((node) => {
      const parent = updated[node.parentKey!];
      const res = calculateNodeTarget(node, parent?.targetRev27);
      updated[node.id] = {
        ...node,
        targetRev27: res.targetRev,
        targetVisits27: res.targetVisits,
        growthRevPct: res.growthRevPct,
        delegatedChildrenRev: 0,
        allocationGap: 0,
        allocationStatus: "balanced",
      };
    });

  // Second pass: Setting Level 3 (OPD / IPD)
  Object.values(updated)
    .filter((n) => n.level === "setting")
    .forEach((node) => {
      const childrenSum = node.childrenKeys.reduce(
        (sum, k) => sum + (updated[k]?.targetRev27 || 0),
        0
      );

      // If user overrode this setting node, calculate its target
      let targetRev = node.targetRev27;
      let targetVisits = node.targetVisits27;
      let growthRevPct = node.growthRevPct;

      if (node.isOverridden) {
        const parent = updated[node.parentKey!];
        const res = calculateNodeTarget(node, parent?.targetRev27);
        targetRev = res.targetRev;
        targetVisits = res.targetVisits;
        growthRevPct = res.growthRevPct;
      } else if (childrenSum > 0) {
        targetRev = childrenSum;
        growthRevPct = node.baseRev26 > 0 ? ((targetRev - node.baseRev26) / node.baseRev26) * 100 : 0;
      }

      const gap = targetRev - childrenSum;
      const status = Math.abs(gap) < 1000 ? "balanced" : gap > 0 ? "under_allocated" : "over_allocated";

      updated[node.id] = {
        ...node,
        targetRev27: targetRev,
        targetVisits27: targetVisits,
        growthRevPct,
        delegatedChildrenRev: childrenSum,
        allocationGap: gap,
        allocationStatus: status,
      };
    });

  // Third pass: CoE Level 2
  Object.values(updated)
    .filter((n) => n.level === "coe")
    .forEach((node) => {
      const childrenSum = node.childrenKeys.reduce(
        (sum, k) => sum + (updated[k]?.targetRev27 || 0),
        0
      );

      let targetRev = node.targetRev27;
      let targetVisits = node.targetVisits27;
      let growthRevPct = node.growthRevPct;

      if (node.isOverridden) {
        const parent = updated[node.parentKey!];
        const res = calculateNodeTarget(node, parent?.targetRev27);
        targetRev = res.targetRev;
        targetVisits = res.targetVisits;
        growthRevPct = res.growthRevPct;
      } else if (childrenSum > 0) {
        targetRev = childrenSum;
        growthRevPct = node.baseRev26 > 0 ? ((targetRev - node.baseRev26) / node.baseRev26) * 100 : 0;
      }

      const gap = targetRev - childrenSum;
      const status = Math.abs(gap) < 1000 ? "balanced" : gap > 0 ? "under_allocated" : "over_allocated";

      updated[node.id] = {
        ...node,
        targetRev27: targetRev,
        targetVisits27: targetVisits,
        growthRevPct,
        delegatedChildrenRev: childrenSum,
        allocationGap: gap,
        allocationStatus: status,
      };
    });

  // Fourth pass: Site Level 1 (BPK, BSI, DBK)
  Object.values(updated)
    .filter((n) => n.level === "site")
    .forEach((node) => {
      const childrenSum = node.childrenKeys.reduce(
        (sum, k) => sum + (updated[k]?.targetRev27 || 0),
        0
      );

      let targetRev = node.targetRev27;
      let targetVisits = node.targetVisits27;
      let growthRevPct = node.growthRevPct;

      if (node.isOverridden) {
        const parent = updated[node.parentKey!];
        const res = calculateNodeTarget(node, parent?.targetRev27);
        targetRev = res.targetRev;
        targetVisits = res.targetVisits;
        growthRevPct = res.growthRevPct;
      } else if (childrenSum > 0) {
        targetRev = childrenSum;
        growthRevPct = node.baseRev26 > 0 ? ((targetRev - node.baseRev26) / node.baseRev26) * 100 : 0;
      }

      const gap = targetRev - childrenSum;
      const status = Math.abs(gap) < 1000 ? "balanced" : gap > 0 ? "under_allocated" : "over_allocated";

      updated[node.id] = {
        ...node,
        targetRev27: targetRev,
        targetVisits27: targetVisits,
        growthRevPct,
        delegatedChildrenRev: childrenSum,
        allocationGap: gap,
        allocationStatus: status,
      };
    });

  // Fifth pass: PKT Level 0 (Central HQ)
  const pktNode = updated["PKT"];
  if (pktNode) {
    const childrenSum = pktNode.childrenKeys.reduce(
      (sum, k) => sum + (updated[k]?.targetRev27 || 0),
      0
    );

    let targetRev = pktNode.targetRev27;
    let growthRevPct = pktNode.growthRevPct;

    if (pktNode.isOverridden) {
      const res = calculateNodeTarget(pktNode);
      targetRev = res.targetRev;
      growthRevPct = res.growthRevPct;
    } else if (childrenSum > 0) {
      targetRev = childrenSum;
      growthRevPct = pktNode.baseRev26 > 0 ? ((targetRev - pktNode.baseRev26) / pktNode.baseRev26) * 100 : 0;
    }

    const gap = targetRev - childrenSum;
    const status = Math.abs(gap) < 1000 ? "balanced" : gap > 0 ? "under_allocated" : "over_allocated";

    updated["PKT"] = {
      ...pktNode,
      targetRev27: targetRev,
      growthRevPct,
      delegatedChildrenRev: childrenSum,
      allocationGap: gap,
      allocationStatus: status,
    };
  }

  return updated;
}

/**
 * Delegate parent target down to its children
 * Mode:
 *  - "proportional": distribute according to each child's 2026 base revenue share
 *  - "equal_growth": apply the parent's overall growth % to all children
 */
export function delegateTargetDown(
  tree: Record<string, TargetTreeNode>,
  parentKey: string,
  mode: "proportional" | "equal_growth" = "proportional"
): Record<string, TargetTreeNode> {
  const updated: Record<string, TargetTreeNode> = { ...tree };
  const parent = updated[parentKey];
  if (!parent || !parent.childrenKeys || parent.childrenKeys.length === 0) return tree;

  const targetToDistribute = parent.targetRev27;
  const parentBaseRev = parent.baseRev26;

  parent.childrenKeys.forEach((childKey) => {
    const child = updated[childKey];
    if (!child) return;

    if (mode === "proportional") {
      const childShare = parentBaseRev > 0 ? child.baseRev26 / parentBaseRev : 1 / parent.childrenKeys.length;
      const childTargetRev = targetToDistribute * childShare;
      const growthRevPct = child.baseRev26 > 0 ? ((childTargetRev - child.baseRev26) / child.baseRev26) * 100 : parent.growthRevPct;

      updated[childKey] = {
        ...child,
        method: "growth_pct",
        inputVal: Number(growthRevPct.toFixed(2)),
        targetRev27: childTargetRev,
        growthRevPct,
        isOverridden: true,
      };
    } else {
      // equal_growth
      const growthRevPct = parent.growthRevPct;
      const childTargetRev = child.baseRev26 * (1 + growthRevPct / 100);

      updated[childKey] = {
        ...child,
        method: "growth_pct",
        inputVal: Number(growthRevPct.toFixed(2)),
        targetRev27: childTargetRev,
        growthRevPct,
        isOverridden: true,
      };
    }

    // Recursively cascade down if child has children
    if (child.childrenKeys && child.childrenKeys.length > 0) {
      const subUpdated = delegateTargetDown(updated, childKey, mode);
      Object.assign(updated, subUpdated);
    }
  });

  return recalculateTargetTree(updated);
}
