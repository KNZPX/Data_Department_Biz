"use client";

import { useCallback, useEffect, useState } from "react";
import type { PowerBiListResponse } from "@/lib/powerbiTypes";

export type PowerBiItemsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "token_error"; code: "token_missing" | "token_expired"; message: string }
  | { status: "ready"; response: PowerBiListResponse };

export function usePowerBiItems(endpoint: string) {
  const [state, setState] = useState<PowerBiItemsState>({ status: "loading" });
  const [refreshToken, setRefreshToken] = useState(0);

  async function load(isManualRefresh = false) {
    setState({ status: "loading" });
    try {
      const url = isManualRefresh
        ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}refresh=true`
        : endpoint;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === "token_missing" || json?.code === "token_expired") {
          setState({
            status: "token_error",
            code: json.code,
            message: json?.error || "The Power BI access token is missing or has expired.",
          });
          return;
        }
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setState({ status: "ready", response: json as PowerBiListResponse });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    }
  }

  useEffect(() => {
    void load(refreshToken > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  return { state, refresh };
}
