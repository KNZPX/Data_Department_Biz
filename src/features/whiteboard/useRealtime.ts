"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { El } from "./model";
import { toneFor } from "@/components/layout/Presence";

export type Peer = {
  key: string;
  name: string;
  email: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[];
  seenAt: number;
};

export type Ops = { upsert?: El[]; remove?: string[] };

let client: SupabaseClient | null = null;
let clientPromise: Promise<{ client: SupabaseClient; user: { name: string; email: string } } | null> | null = null;

export async function getRealtimeClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const res = await fetch("/api/realtime-config", { cache: "no-store" });
      if (!res.ok) return null;
      const { url, key, user } = await res.json();
      client = client || createClient(url, key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 30 } } });
      return { client, user };
    })();
  }
  return clientPromise;
}

/**
 * One Realtime channel per board: presence (who is here), `cursor` broadcasts
 * (throttled) and `ops` broadcasts (element upserts/removals).
 */
export function useBoardRealtime(boardId: string | null, onRemoteOps: (ops: Ops) => void) {
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [me, setMe] = useState<{ name: string; email: string; color: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceKey] = useState(() => Math.random().toString(36).slice(2));
  const keyRef = useRef(presenceKey);
  const opsRef = useRef(onRemoteOps);
  const lastCursor = useRef(0);
  const selectionRef = useRef<string[]>([]);

  useEffect(() => {
    opsRef.current = onRemoteOps;
  }, [onRemoteOps]);

  useEffect(() => {
    if (!boardId) return;
    let alive = true;
    let channel: RealtimeChannel | null = null;
    (async () => {
      const got = await getRealtimeClient();
      if (!got || !alive) return;
      const color = toneFor(got.user.email);
      setMe({ ...got.user, color });
      channel = got.client.channel(`wb:${boardId}`, {
        config: { broadcast: { self: false }, presence: { key: keyRef.current } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState() as Record<string, { name: string; email: string; color: string }[]>;
          setPeers((prev) => {
            const next: Record<string, Peer> = {};
            for (const [k, metas] of Object.entries(state)) {
              if (k === keyRef.current) continue;
              const m = metas[0];
              next[k] = prev[k] || { key: k, name: m.name, email: m.email, color: m.color, cursor: null, selection: [], seenAt: Date.now() };
            }
            return next;
          });
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => {
          const p = payload as { key: string; x: number; y: number; name: string; email: string; color: string; selection: string[] };
          setPeers((prev) => ({
            ...prev,
            [p.key]: {
              key: p.key,
              name: p.name,
              email: p.email,
              color: p.color,
              cursor: Number.isFinite(p.x) ? { x: p.x, y: p.y } : null,
              selection: p.selection || [],
              seenAt: Date.now(),
            },
          }));
        })
        .on("broadcast", { event: "ops" }, ({ payload }) => opsRef.current(payload as Ops))
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setConnected(true);
            await channel!.track({ name: got.user.name, email: got.user.email, color });
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnected(false);
          }
        });
      channelRef.current = channel;
    })();
    return () => {
      alive = false;
      setConnected(false);
      setPeers({});
      if (channel && client) void client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId]);

  function sendOps(ops: Ops) {
    const ch = channelRef.current;
    if (!ch || (!ops.upsert?.length && !ops.remove?.length)) return;
    void ch.send({ type: "broadcast", event: "ops", payload: ops });
  }

  function sendCursor(pt: { x: number; y: number } | null, selection?: string[]) {
    const ch = channelRef.current;
    if (!ch || !me) return;
    if (selection) selectionRef.current = selection;
    const now = performance.now();
    if (pt && now - lastCursor.current < 40) return;
    lastCursor.current = now;
    void ch.send({
      type: "broadcast",
      event: "cursor",
      payload: { key: keyRef.current, x: pt ? pt.x : NaN, y: pt ? pt.y : NaN, ...me, selection: selectionRef.current },
    });
  }

  return { peers: Object.values(peers), me, connected, sendOps, sendCursor };
}
