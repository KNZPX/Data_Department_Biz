"use client";

// Working together on one DAX item: who else has it open, review status,
// watching, and a comment thread with @mentions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell, BellOff, CheckCircle2, CircleDashed, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { getRealtimeClient } from "@/features/whiteboard/useRealtime";
import { initialsOf, toneFor } from "@/components/layout/Presence";
import { confirmDialog, toast } from "@/components/feedback";
import { useAuth } from "@/components/auth/LoginGate";
import { useT } from "@/lib/i18n";

export type CollabComment = { id: string; body: string; authorEmail: string; authorName: string; mentions: string[]; createdAt: string };
export type CollabReview = { status: "draft" | "reviewed"; reviewedBy: string | null; reviewedAt: string | null; note: string | null };
export type Collab = { comments: CollabComment[]; review: CollabReview; watching: boolean; watchers: number };
export type ItemRef = { id: string; name: string; modelCode: string };
type Peer = { key: string; name: string; email: string; editing: boolean };

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isCollab(j: unknown): j is Collab {
  const c = j as Collab | null;
  return Boolean(c && Array.isArray(c.comments) && c.review && typeof c.review.status === "string");
}

/** Load + mutate the collaboration state for one item. */
export function useItemCollab(item: ItemRef | null) {
  const [data, setData] = useState<Collab | null>(null);
  const id = item?.id || null;
  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/dax/collab?item=${encodeURIComponent(id)}`, { cache: "no-store" }).catch(() => null);
    const j = res?.ok ? await res.json().catch(() => null) : null;
    if (isCollab(j)) setData(j);
  }, [id]);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    fetch(`/api/dax/collab?item=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && isCollab(j) && setData(j))
      .catch(() => {});
    return () => {
      alive = false;
      setData(null);
    };
  }, [id]);

  async function post(body: Record<string, unknown>) {
    if (!item) return null;
    const res = await fetch("/api/dax/collab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, itemName: item.name, modelCode: item.modelCode, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "The server didn't accept it");
    return json;
  }

  return { data, setData, load, post };
}

/** Everyone else who has this item open right now (and whether they're editing). */
export function useItemPresence(itemId: string | null, editing: boolean): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<{ name: string; email: string } | null>(null);
  const [key] = useState(() => Math.random().toString(36).slice(2));
  const editingRef = useRef(editing);

  useEffect(() => {
    editingRef.current = editing;
    const ch = channelRef.current;
    if (ch && meRef.current) void ch.track({ ...meRef.current, editing });
  }, [editing]);

  useEffect(() => {
    if (!itemId) return;
    let alive = true;
    let channel: RealtimeChannel | null = null;
    (async () => {
      const got = await getRealtimeClient().catch(() => null);
      if (!got || !alive) return;
      meRef.current = got.user;
      channel = got.client.channel(`dax:${itemId}`, { config: { presence: { key } } });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState() as Record<string, { name: string; email: string; editing: boolean }[]>;
          const list: Peer[] = [];
          for (const [k, metas] of Object.entries(state)) {
            if (k === key || !metas[0]) continue;
            list.push({ key: k, name: metas[0].name, email: metas[0].email, editing: metas.some((m) => m.editing) });
          }
          // One chip per person even with two tabs open.
          const byEmail = new Map<string, Peer>();
          for (const p of list) byEmail.set(p.email, { ...p, editing: p.editing || byEmail.get(p.email)?.editing || false });
          setPeers(Array.from(byEmail.values()).filter((p) => p.email !== got.user.email));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void channel!.track({ ...got.user, editing: editingRef.current });
        });
      channelRef.current = channel;
    })();
    return () => {
      alive = false;
      setPeers([]);
      if (channel) void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [itemId, key]);

  return peers;
}

export function PresenceChips({ peers }: { peers: Peer[] }) {
  const t = useT();
  if (!peers.length) return null;
  const editing = peers.filter((p) => p.editing);
  return (
    <div className="fade-enter flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600" role="status">
      <div className="flex -space-x-1.5">
        {peers.slice(0, 4).map((p) => (
          <span
            key={p.key}
            title={`${p.name} — ${p.editing ? t("editing") : t("viewing")}`}
            className={clsx("grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white ring-2", p.editing ? "ring-amber-300" : "ring-white")}
            style={{ background: toneFor(p.email) }}
          >
            {initialsOf(p.name)}
          </span>
        ))}
      </div>
      {editing.length ? (
        <span className="font-medium text-amber-700">
          {editing.map((p) => p.name.split(" ")[0]).join(", ")} {t("editing")}…
        </span>
      ) : (
        <span>
          {t("Also here")}: {peers.map((p) => p.name.split(" ")[0]).join(", ")}
        </span>
      )}
    </div>
  );
}

export function ReviewAndWatch({
  collab,
  canReview,
  onReview,
  onWatch,
}: {
  collab: Collab | null;
  canReview: boolean;
  onReview: (status: "draft" | "reviewed") => void;
  onWatch: (on: boolean) => void;
}) {
  const t = useT();
  const reviewed = collab?.review.status === "reviewed";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={!canReview || !collab}
        onClick={() => onReview(reviewed ? "draft" : "reviewed")}
        className={clsx(
          "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition disabled:cursor-default",
          reviewed ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        )}
        title={
          reviewed
            ? `${t("Reviewed")} — ${collab?.review.reviewedBy || ""}${collab?.review.reviewedAt ? ` · ${ago(collab.review.reviewedAt)}` : ""}${canReview ? ` · ${t("Back to draft")}` : ""}`
            : collab?.review.note || (canReview ? t("Mark as reviewed") : t("Draft"))
        }
      >
        {reviewed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
        {reviewed ? `${t("Reviewed")}${collab?.review.reviewedBy ? ` · ${collab.review.reviewedBy.split(" ")[0]}` : ""}` : t("Draft")}
      </button>
      <button
        type="button"
        disabled={!collab}
        onClick={() => onWatch(!collab?.watching)}
        className={clsx(
          "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition",
          collab?.watching ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "text-slate-500 hover:bg-slate-100"
        )}
        title={collab?.watching ? "You'll be told about comments, reviews and formula changes" : "Get notified about comments, reviews and formula changes"}
      >
        {collab?.watching ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        {collab?.watching ? t("Watching") : t("Watch")}
        {collab && collab.watchers > 0 && <span className="tabular-nums text-[11px] opacity-70">{collab.watchers}</span>}
      </button>
    </div>
  );
}

let peopleCache: { email: string; name: string }[] | null = null;

export function CommentsSection({
  collab,
  onPost,
  onDelete,
}: {
  collab: Collab | null;
  onPost: (text: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [people, setPeople] = useState(peopleCache || []);
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [pick, setPick] = useState(0);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (peopleCache) return;
    fetch("/api/dax/collab?people=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.people) return;
        peopleCache = j.people;
        setPeople(j.people);
      })
      .catch(() => {});
  }, []);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.email.includes(q)).slice(0, 6);
  }, [mention, people]);

  function onChange(v: string, caret: number) {
    setText(v);
    const m = /@([\p{L}\p{N}._-]*)$/u.exec(v.slice(0, caret));
    setMention(m ? { q: m[1], start: caret - m[0].length } : null);
    setPick(0);
  }
  function insertMention(p: { email: string; name: string }) {
    if (!mention) return;
    const handle = p.email.split("@")[0];
    const caret = boxRef.current?.selectionStart ?? text.length;
    const next = text.slice(0, mention.start) + "@" + handle + " " + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + handle.length + 2;
      boxRef.current?.focus();
      boxRef.current?.setSelectionRange(pos, pos);
    });
  }
  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (await onPost(body)) setText("");
    setSending(false);
  }

  const nameFor = (email: string) => people.find((p) => p.email === email)?.name || email.split("@")[0];
  const render = (c: CollabComment) =>
    c.body.split(/(@[\p{L}\p{N}._-]+(?:@[\w.-]+)?)/u).map((part, i) =>
      part.startsWith("@") && c.mentions.some((m) => m === part.slice(1).toLowerCase() || m.split("@")[0] === part.slice(1).toLowerCase()) ? (
        <span key={i} className="rounded bg-blue-50 px-1 font-medium text-blue-700">
          @{nameFor(c.mentions.find((m) => m === part.slice(1).toLowerCase() || m.split("@")[0] === part.slice(1).toLowerCase())!)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-slate-900">{t("Comments")}</h3>
        {collab && collab.comments.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500">{collab.comments.length}</span>}
      </div>
      {!collab ? (
        <div className="skeleton h-10 rounded-lg" />
      ) : (
        <ol className="space-y-3">
          {collab.comments.map((c) => (
            <li key={c.id} className="group flex gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white" style={{ background: toneFor(c.authorEmail) }}>
                {initialsOf(c.authorName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[12px]">
                  <span className="font-medium text-slate-900">{c.authorName}</span>
                  <span className="text-slate-400">{ago(c.createdAt)}</span>
                  {user?.email && c.authorEmail === user.email.toLowerCase() && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirmDialog({ title: "Delete this comment?", confirmLabel: "Delete", danger: true })) onDelete(c.id);
                      }}
                      className="ml-auto grid h-5 w-5 place-items-center rounded text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{render(c)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="relative mt-3">
        <textarea
          ref={boxRef}
          rows={2}
          value={text}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (mention && suggestions.length) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setPick((p) => (p + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setPick((p) => (p - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(suggestions[pick]);
                return;
              }
              if (e.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t("Write a comment… use @ to mention")}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 pr-11 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className="absolute bottom-2.5 right-2 grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
          title={`${t("Post")} (Ctrl Enter)`}
          aria-label={t("Post")}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
        {mention && suggestions.length > 0 && (
          <div role="listbox" className="pop-in absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
            {suggestions.map((p, i) => (
              <button
                key={p.email}
                type="button"
                role="option"
                aria-selected={i === pick}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                className={clsx("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]", i === pick ? "bg-blue-50" : "hover:bg-slate-50")}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white" style={{ background: toneFor(p.email) }}>
                  {initialsOf(p.name)}
                </span>
                <span className="truncate font-medium text-slate-800">{p.name}</span>
                <span className="ml-auto truncate text-[11px] text-slate-400">{p.email.split("@")[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
        <MessageSquare className="h-3 w-3" /> Everyone watching this item is notified. Ctrl Enter to post.
      </p>
    </section>
  );
}

/** Small wrapper so the page can post/delete/review/watch with toasts and optimistic updates. */
export function useCollabActions(item: ItemRef | null, c: ReturnType<typeof useItemCollab>) {
  return {
    async comment(text: string) {
      try {
        await c.post({ action: "comment", text });
        await c.load();
        return true;
      } catch (e) {
        toast.error("Couldn't post the comment", { body: e instanceof Error ? e.message : undefined });
        return false;
      }
    },
    async remove(id: string) {
      try {
        await c.post({ action: "delete_comment", id });
        await c.load();
      } catch (e) {
        toast.error("Couldn't delete the comment", { body: e instanceof Error ? e.message : undefined });
      }
    },
    async review(status: "draft" | "reviewed") {
      try {
        const j = await c.post({ action: "review", status });
        if (j?.review) c.setData((d) => (d ? { ...d, review: j.review } : d));
        toast(status === "reviewed" ? "Marked as reviewed" : "Back to draft", { body: item?.name });
      } catch (e) {
        toast.error("Couldn't change the review status", { body: e instanceof Error ? e.message : undefined });
      }
    },
    async watch(on: boolean) {
      c.setData((d) => (d ? { ...d, watching: on, watchers: Math.max(0, d.watchers + (on ? 1 : -1)) } : d));
      try {
        await c.post({ action: "watch", on });
        toast(on ? "Watching" : "Stopped watching", { body: on ? "You'll get a notification for comments, reviews and formula changes." : undefined });
      } catch (e) {
        c.setData((d) => (d ? { ...d, watching: !on, watchers: Math.max(0, d.watchers + (on ? -1 : 1)) } : d));
        toast.error("Couldn't change watching", { body: e instanceof Error ? e.message : undefined });
      }
    },
  };
}
