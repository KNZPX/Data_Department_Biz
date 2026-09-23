import { NextRequest } from "next/server";
import { getAllDashboards, PowerBiTokenError } from "@/lib/powerbi";
import { syncPowerBiItemsToDatabase } from "@/lib/powerbiSync";
import type { PowerBiItem, PowerBiListResponse } from "@/lib/powerbiTypes";
import { getDbItems } from "@/lib/db";

export const dynamic = "force-dynamic";

let memoryCache: { response: PowerBiListResponse; cachedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;
let isFetchingUpstream = false;

async function refreshUpstream(): Promise<PowerBiListResponse> {
  const { items, workspaceCount, skipped } = await getAllDashboards();
  try {
    await syncPowerBiItemsToDatabase(items, "dashboard");
  } catch (err) {
    console.error("Sync error for powerbi dashboards:", err);
  }

  const response: PowerBiListResponse = {
    data: items,
    meta: {
      workspaceCount,
      itemCount: items.length,
      codedCount: items.filter((item) => item.reportCode).length,
      fetchedAt: new Date().toISOString(),
      skippedWorkspaces: skipped,
    },
  };

  memoryCache = { response, cachedAt: Date.now() };
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!forceRefresh && memoryCache && Date.now() - memoryCache.cachedAt < CACHE_TTL_MS) {
      return Response.json(memoryCache.response);
    }

    if (!forceRefresh) {
      const cachedItems = await getDbItems("dashboard");
      if (cachedItems.length > 0) {
        const uniqueWorkspaces = new Set(cachedItems.map((i) => i.workspaceId)).size;
        const response: PowerBiListResponse = {
          data: cachedItems,
          meta: {
            workspaceCount: uniqueWorkspaces,
            itemCount: cachedItems.length,
            codedCount: cachedItems.filter((item) => item.reportCode).length,
            fetchedAt: memoryCache?.response.meta.fetchedAt || new Date().toISOString(),
            skippedWorkspaces: [],
          },
        };
        memoryCache = { response, cachedAt: Date.now() };

        if (!isFetchingUpstream) {
          isFetchingUpstream = true;
          void refreshUpstream()
            .catch((err) => console.error("Background Power BI dashboards refresh failed:", err))
            .finally(() => {
              isFetchingUpstream = false;
            });
        }

        return Response.json(response);
      }
    }

    const response = await refreshUpstream();
    return Response.json(response);
  } catch (error) {
    if (error instanceof PowerBiTokenError) {
      return Response.json({ error: error.message, code: error.code }, { status: 401 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load dashboards" }, { status: 502 });
  }
}
