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
  "Outreach Clinic & BTL": 0.95,
  "SBU PPSI": 0.55,
  "SBU Wellness": 0.90,
  "SBU Urology": 0.70,
  "Elective Surgery": 0.30,
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
  const pktTargetRev27 = 7550 * 1_000_000; // 7,550.0 MB
  const pktGrowthRevPct = pktBaseRev26 > 0 ? ((pktTargetRev27 - pktBaseRev26) / pktBaseRev26) * 100 : 6.90;

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
    method: "fixed_amount",
    inputVal: 7550.0, // 7,550.0 MB
    unitType: "MB",
    isOverridden: false,
    targetRev27: pktTargetRev27,
    targetVisits27: pktBaseVisits26 * (1 + (pktGrowthRevPct * 0.5) / 100),
    growthRevPct: Number(pktGrowthRevPct.toFixed(2)),
    growthVisitsPct: Number((pktGrowthRevPct * 0.5).toFixed(2)),
    delegatedChildrenRev: 0,
    allocationGap: 0,
    allocationStatus: "balanced",
  };

  // 2. Level 1: Sites (BPK, BSI, DBK)
  const SITE_TARGETS_MB: Record<string, number> = {
    BPK: 5140.0,
    BSI: 2035.0,
    "DBK (Premium)": 375.0,
    DBK: 375.0,
  };

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
    const siteTargetMB = SITE_TARGETS_MB[site] || 0;
    const siteTargetRev27 = siteTargetMB * 1_000_000;
    const siteGrowthRevPct = sBaseRev > 0 ? ((siteTargetRev27 - sBaseRev) / sBaseRev) * 100 : 0;

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
      method: "fixed_amount",
      inputVal: siteTargetMB,
      unitType: "MB",
      isOverridden: false,
      targetRev27: siteTargetRev27,
      targetVisits27: sBaseVisits * (1 + (siteGrowthRevPct * 0.5) / 100),
      growthRevPct: Number(siteGrowthRevPct.toFixed(2)),
      growthVisitsPct: Number((siteGrowthRevPct * 0.5).toFixed(2)),
      delegatedChildrenRev: 0,
      allocationGap: 0,
      allocationStatus: "balanced",
    };

    // 3. Level 2: COE / SBU Units
    siteUnits.forEach((u) => {
      const coeKey = `${site}||${u.coe}`;
      const settingChildren = [`${coeKey}||OPD`, `${coeKey}||IPD`];

      let uPriorRev = 0;
      let uPriorVisits = 0;
      u.months.forEach((m) => {
        uPriorRev += m.rev25 || 0;
        uPriorVisits += m.visit25 || 0;
      });

      // Default strategic target from Revise 2027 (V2)
      const unitSnap = VERIFIED_BASE_CASE?.snap?.rev?.unit?.[coeKey];
      let coeTargetRev = u.base_rev * (1 + siteGrowthRevPct / 100);
      let coeInputVal = Number(siteGrowthRevPct.toFixed(2));
      let coeMethod: TargetMethod = "growth_pct";
      let coeUnitType: "MB" | "pct" = "pct";

      if (unitSnap && unitSnap.mode === "amount" && unitSnap.value) {
        const mbVal = parseFloat(unitSnap.value);
        coeTargetRev = mbVal * 1_000_000;
        coeInputVal = mbVal;
        coeMethod = "fixed_amount";
        coeUnitType = "MB";
      } else if (unitSnap && unitSnap.mode === "growth" && unitSnap.value) {
        const pctVal = parseFloat(unitSnap.value);
        coeTargetRev = u.base_rev * (1 + pctVal / 100);
        coeInputVal = pctVal;
        coeMethod = "growth_pct";
        coeUnitType = "pct";
      }

      const coeGrowthRevPct = u.base_rev > 0 ? ((coeTargetRev - u.base_rev) / u.base_rev) * 100 : 0;
      const coeTargetVisits = u.base_visit * (1 + (coeGrowthRevPct * 0.55) / 100);

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
        method: coeMethod,
        inputVal: coeInputVal,
        unitType: coeUnitType,
        isOverridden: false,
        targetRev27: coeTargetRev,
        targetVisits27: coeTargetVisits,
        growthRevPct: Number(coeGrowthRevPct.toFixed(2)),
        growthVisitsPct: Number((coeGrowthRevPct * 0.55).toFixed(2)),
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
        const setBaseVisits = u.base_visit * (setting === "OPD" ? 0.85 : 0.15);
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
          inputVal: Number(coeGrowthRevPct.toFixed(2)),
          unitType: "pct",
          isOverridden: false,
          targetRev27: setTargetRev,
          targetVisits27: setTargetVisits,
          growthRevPct: Number(coeGrowthRevPct.toFixed(2)),
          growthVisitsPct: Number((coeGrowthRevPct * 0.55).toFixed(2)),
          delegatedChildrenRev: 0,
          allocationGap: 0,
          allocationStatus: "balanced",
        };

        // 5. Level 4: Market Segments (Thai, Expat, Fly-in)
        const siteMarketRatios = DEFAULT_SITE_MARKET_RATIOS[site] || {
          Thai: 0.5,
          Expat: 0.25,
          "Fly-in": 0.25,
        };

        (["Thai", "Expat", "Fly-in"] as const).forEach((mkt) => {
          const mktKey = `${settingKey}||${mkt}`;
          const mktRatio = siteMarketRatios[mkt] || 0.3333;
          const mktBaseRev = setBaseRev * mktRatio;
          const mktPriorRev = setPriorRev * mktRatio;
          const mktBaseVisits = setBaseVisits * mktRatio;
          const mktPriorVisits = setPriorVisits * mktRatio;

          const mktTargetRev = setTargetRev * mktRatio;
          const mktTargetVisits = setTargetVisits * mktRatio;

          tree[mktKey] = {
            id: mktKey,
            level: "market",
            name: `${u.coe} - ${setting} (${mkt})`,
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
            inputVal: Number(coeGrowthRevPct.toFixed(2)),
            unitType: "pct",
            isOverridden: false,
            targetRev27: mktTargetRev,
            targetVisits27: mktTargetVisits,
            growthRevPct: Number(coeGrowthRevPct.toFixed(2)),
            growthVisitsPct: Number((coeGrowthRevPct * 0.55).toFixed(2)),
            delegatedChildrenRev: 0,
            allocationGap: 0,
            allocationStatus: "balanced",
          };
        });
      });
    });
  });

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
export type DelegationMode =
  | "scaled_profile"   // Method 1: Scaled Profile Allocation (Preserve Strategic Priority - Recommended)
  | "tiered_weighted"  // Method 2: Strategic Tiered Weights (CoE 1.5x, SBU 1.0x, Usual 0.5x)
  | "plug_usual"       // Method 3: Core Lock + Plug to Usual Business
  | "flat_base"        // Method 4: Historical Base Proportional (Old flat growth method)
  | "proportional"     // Alias for flat_base
  | "equal_growth";    // Alias for flat_base

/**
 * Delegate parent target down to its children using corporate finance allocation methods
 */
export function delegateTargetDown(
  tree: Record<string, TargetTreeNode>,
  parentKey: string,
  mode: DelegationMode = "scaled_profile"
): Record<string, TargetTreeNode> {
  const updated: Record<string, TargetTreeNode> = { ...tree };
  const parent = updated[parentKey];
  if (!parent || !parent.childrenKeys || parent.childrenKeys.length === 0) return tree;

  const targetToDistribute = parent.targetRev27;
  const parentBaseRev = parent.baseRev26;
  const children = parent.childrenKeys.map((k) => updated[k]).filter(Boolean);
  if (children.length === 0) return tree;

  if (mode === "scaled_profile") {
    // Method 1: Preserved Strategic Profile
    // Scales each child's current strategic target proportionally so sum equals parent target.
    // Preserves higher growth for CoE / DBK and doesn't flatten everyone to the same growth rate!
    const curChildrenTargetSum = children.reduce((s, c) => s + (c.targetRev27 || c.baseRev26), 0);
    const scale = curChildrenTargetSum > 0 ? targetToDistribute / curChildrenTargetSum : (parentBaseRev > 0 ? targetToDistribute / parentBaseRev : 1);

    children.forEach((child) => {
      const childTargetRev = (child.targetRev27 || child.baseRev26) * scale;
      const growthRevPct = child.baseRev26 > 0 ? ((childTargetRev - child.baseRev26) / child.baseRev26) * 100 : parent.growthRevPct;
      const mbVal = Number((childTargetRev / 1_000_000).toFixed(2));

      updated[child.id] = {
        ...child,
        method: "fixed_amount",
        inputVal: mbVal,
        unitType: "MB",
        targetRev27: childTargetRev,
        growthRevPct: Number(growthRevPct.toFixed(2)),
        isOverridden: true,
      };

      if (child.childrenKeys && child.childrenKeys.length > 0) {
        const subUpdated = delegateTargetDown(updated, child.id, "scaled_profile");
        Object.assign(updated, subUpdated);
      }
    });
  } else if (mode === "tiered_weighted") {
    // Method 2: Strategic Tiered Allocation
    // Gives higher growth quota to CoE (1.5x) and SBU (1.0x), and lower to Usual Business (0.5x)
    const getTierWeight = (node: TargetTreeNode): number => {
      if (node.level === "site") {
        return node.code === "DBK (Premium)" || node.code === "DBK" ? 2.5 : node.code === "BSI" ? 1.1 : 1.0;
      }
      if (node.group === "CoE") return 1.5;
      if (node.group === "SBU") return 1.0;
      if (node.group === "Hospital Focus") return 1.3;
      return 0.5; // Usual Business
    };

    const deltaTarget = targetToDistribute - parentBaseRev;
    const totalWeightedBase = children.reduce((s, c) => s + c.baseRev26 * getTierWeight(c), 0);

    children.forEach((child) => {
      const weight = getTierWeight(child);
      const childShare = totalWeightedBase > 0 ? (child.baseRev26 * weight) / totalWeightedBase : 1 / children.length;
      const childDelta = deltaTarget * childShare;
      const childTargetRev = child.baseRev26 + childDelta;
      const growthRevPct = child.baseRev26 > 0 ? (childDelta / child.baseRev26) * 100 : parent.growthRevPct;
      const mbVal = Number((childTargetRev / 1_000_000).toFixed(2));

      updated[child.id] = {
        ...child,
        method: "fixed_amount",
        inputVal: mbVal,
        unitType: "MB",
        targetRev27: childTargetRev,
        growthRevPct: Number(growthRevPct.toFixed(2)),
        isOverridden: true,
      };

      if (child.childrenKeys && child.childrenKeys.length > 0) {
        const subUpdated = delegateTargetDown(updated, child.id, "scaled_profile");
        Object.assign(updated, subUpdated);
      }
    });
  } else if (mode === "plug_usual") {
    // Method 3: Core Lock + Plug to Usual Business
    // Keep strategic CoE & SBU locked; remainder goes into Usual Business
    const usualChild = children.find((c) => c.name.includes("Usual Business"));
    if (usualChild) {
      const otherChildrenSum = children
        .filter((c) => c.id !== usualChild.id)
        .reduce((s, c) => s + c.targetRev27, 0);

      const usualTargetRev = Math.max(0, targetToDistribute - otherChildrenSum);
      const usualGrowthPct = usualChild.baseRev26 > 0 ? ((usualTargetRev - usualChild.baseRev26) / usualChild.baseRev26) * 100 : 0;

      updated[usualChild.id] = {
        ...usualChild,
        method: "fixed_amount",
        inputVal: Number((usualTargetRev / 1_000_000).toFixed(2)),
        unitType: "MB",
        targetRev27: usualTargetRev,
        growthRevPct: Number(usualGrowthPct.toFixed(2)),
        isOverridden: true,
      };

      if (usualChild.childrenKeys && usualChild.childrenKeys.length > 0) {
        const subUpdated = delegateTargetDown(updated, usualChild.id, "scaled_profile");
        Object.assign(updated, subUpdated);
      }
    } else {
      // Fallback to scaled profile if no usual business node
      return delegateTargetDown(tree, parentKey, "scaled_profile");
    }
  } else {
    // Method 4: Flat Base Proportional (Old Method)
    children.forEach((child) => {
      const childShare = parentBaseRev > 0 ? child.baseRev26 / parentBaseRev : 1 / children.length;
      const childTargetRev = targetToDistribute * childShare;
      const growthRevPct = child.baseRev26 > 0 ? ((childTargetRev - child.baseRev26) / child.baseRev26) * 100 : parent.growthRevPct;

      updated[child.id] = {
        ...child,
        method: "growth_pct",
        inputVal: Number(growthRevPct.toFixed(2)),
        unitType: "pct",
        targetRev27: childTargetRev,
        growthRevPct: Number(growthRevPct.toFixed(2)),
        isOverridden: true,
      };

      if (child.childrenKeys && child.childrenKeys.length > 0) {
        const subUpdated = delegateTargetDown(updated, child.id, mode);
        Object.assign(updated, subUpdated);
      }
    });
  }

  return recalculateTargetTree(updated);
}
