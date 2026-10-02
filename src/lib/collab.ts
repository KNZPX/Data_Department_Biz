// Server-only: comments, review status, watching and notifications for DAX items.
import { getSupabaseClient } from "./db";

export type Comment = {
  id: string;
  itemId: string;
  body: string;
  authorEmail: string;
  authorName: string;
  mentions: string[];
  createdAt: string;
};
export type Review = { status: "draft" | "reviewed"; reviewedBy: string | null; reviewedAt: string | null; note: string | null };
export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  actor: string | null;
  createdAt: string;
  readAt: string | null;
};

type Person = { email: string; name: string };

const lower = (s: string) => s.toLowerCase();

export function itemLink(itemId: string, modelCode?: string | null) {
  return `/dax?model=${encodeURIComponent(modelCode || "ALL")}&item=${encodeURIComponent(itemId)}`;
}

export async function getItemCollab(itemId: string, me: string) {
  const sb = getSupabaseClient();
  const [c, r, w] = await Promise.all([
    sb.from("dax_comments").select("*").eq("item_id", itemId).is("deleted_at", null).order("created_at", { ascending: true }).limit(200),
    sb.from("dax_item_reviews").select("*").eq("item_id", itemId).maybeSingle(),
    sb.from("dax_watches").select("user_email").eq("item_id", itemId),
  ]);
  if (c.error) throw c.error;
  const watchers = (w.data || []).map((x) => lower(x.user_email));
  return {
    comments: (c.data || []).map(
      (x): Comment => ({
        id: x.id,
        itemId: x.item_id,
        body: x.body,
        authorEmail: x.author_email,
        authorName: x.author_name || x.author_email,
        mentions: x.mentions || [],
        createdAt: x.created_at,
      })
    ),
    review: r.data
      ? ({ status: r.data.status, reviewedBy: r.data.reviewed_by, reviewedAt: r.data.reviewed_at, note: r.data.note } as Review)
      : ({ status: "draft", reviewedBy: null, reviewedAt: null, note: null } as Review),
    watching: watchers.includes(lower(me)),
    watchers: watchers.length,
  };
}

/** Review status for many items at once (list badges). */
export async function getReviewMap(): Promise<Record<string, Review["status"]>> {
  const { data } = await getSupabaseClient().from("dax_item_reviews").select("item_id, status");
  const out: Record<string, Review["status"]> = {};
  for (const r of data || []) out[r.item_id] = r.status;
  return out;
}

/** Comment counts per item (list badges). */
export async function getCommentCounts(): Promise<Record<string, number>> {
  const { data } = await getSupabaseClient().from("dax_comments").select("item_id").is("deleted_at", null).limit(10000);
  const out: Record<string, number> = {};
  for (const r of data || []) out[r.item_id] = (out[r.item_id] || 0) + 1;
  return out;
}

export async function listPeople(): Promise<Person[]> {
  const { data } = await getSupabaseClient().from("app_users").select("email, name, is_active").order("name");
  return (data || []).filter((u) => u.is_active !== false).map((u) => ({ email: lower(u.email), name: u.name || u.email }));
}

/** "@Nok", "@nok.s" or "@nok@bdms.co.th" → matching people (by name start, email or email name). */
export function resolveMentions(body: string, people: Person[]): Person[] {
  const tags = Array.from(body.matchAll(/@([\p{L}\p{N}._-]+(?:@[\w.-]+)?)/gu)).map((m) => lower(m[1]));
  const out = new Map<string, Person>();
  for (const tag of tags) {
    const hit =
      people.find((p) => p.email === tag) ||
      people.find((p) => p.email.split("@")[0] === tag) ||
      people.find((p) => lower(p.name).replace(/\s+/g, "") === tag) ||
      people.find((p) => lower(p.name).split(/\s+/)[0] === tag);
    if (hit) out.set(hit.email, hit);
  }
  return Array.from(out.values());
}

async function watchersOf(itemId: string): Promise<string[]> {
  const { data } = await getSupabaseClient().from("dax_watches").select("user_email").eq("item_id", itemId);
  return (data || []).map((x) => lower(x.user_email));
}

export async function setWatching(itemId: string, email: string, on: boolean) {
  const sb = getSupabaseClient();
  if (on) {
    const { error } = await sb.from("dax_watches").upsert({ item_id: itemId, user_email: lower(email) }, { onConflict: "item_id,user_email" });
    if (error) throw error;
  } else {
    const { error } = await sb.from("dax_watches").delete().eq("item_id", itemId).eq("user_email", lower(email));
    if (error) throw error;
  }
}

export async function notify(
  recipients: string[],
  n: { kind: string; title: string; body?: string | null; link?: string | null; actor?: string | null },
  except?: string
) {
  const to = Array.from(new Set(recipients.map(lower))).filter((e) => e && e !== lower(except || ""));
  if (!to.length) return;
  const rows = to.map((user_email) => ({ user_email, kind: n.kind, title: n.title, body: n.body || null, link: n.link || null, actor: n.actor || null }));
  const { error } = await getSupabaseClient().from("app_notifications").insert(rows);
  if (error) console.error("notify failed", error);
}

export async function addComment(opts: { itemId: string; itemName: string; modelCode: string | null; body: string; me: Person }) {
  const people = await listPeople();
  const mentioned = resolveMentions(opts.body, people);
  const { data, error } = await getSupabaseClient()
    .from("dax_comments")
    .insert({
      item_id: opts.itemId,
      item_name: opts.itemName,
      model_code: opts.modelCode,
      body: opts.body,
      author_email: lower(opts.me.email),
      author_name: opts.me.name,
      mentions: mentioned.map((p) => p.email),
    })
    .select("*")
    .single();
  if (error) throw error;
  // Commenting means you care: watch it from now on.
  await setWatching(opts.itemId, opts.me.email, true).catch(() => {});
  const link = itemLink(opts.itemId, opts.modelCode);
  const snippet = opts.body.length > 140 ? opts.body.slice(0, 140) + "…" : opts.body;
  await notify(mentioned.map((p) => p.email), { kind: "mention", title: `${opts.me.name} mentioned you on ${opts.itemName}`, body: snippet, link, actor: opts.me.name }, opts.me.email);
  const watchers = (await watchersOf(opts.itemId)).filter((e) => !mentioned.some((m) => m.email === e));
  await notify(watchers, { kind: "comment", title: `${opts.me.name} commented on ${opts.itemName}`, body: snippet, link, actor: opts.me.name }, opts.me.email);
  return data;
}

export async function deleteComment(id: string, me: Person, isAdmin: boolean) {
  const sb = getSupabaseClient();
  const { data } = await sb.from("dax_comments").select("author_email").eq("id", id).maybeSingle();
  if (!data) return false;
  if (!isAdmin && lower(data.author_email) !== lower(me.email)) throw new Error("You can only delete your own comments.");
  const { error } = await sb.from("dax_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return true;
}

export async function setReview(opts: { itemId: string; itemName: string; modelCode: string | null; status: Review["status"]; me: Person; note?: string | null }) {
  const now = new Date().toISOString();
  const row = {
    item_id: opts.itemId,
    status: opts.status,
    reviewed_by: opts.status === "reviewed" ? opts.me.name : null,
    reviewed_at: opts.status === "reviewed" ? now : null,
    note: opts.note || null,
    updated_at: now,
  };
  const { error } = await getSupabaseClient().from("dax_item_reviews").upsert(row, { onConflict: "item_id" });
  if (error) throw error;
  await notify(
    await watchersOf(opts.itemId),
    {
      kind: "review",
      title: opts.status === "reviewed" ? `${opts.me.name} marked ${opts.itemName} as reviewed` : `${opts.itemName} is back to draft`,
      link: itemLink(opts.itemId, opts.modelCode),
      actor: opts.me.name,
    },
    opts.me.email
  );
  return { status: row.status, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at, note: row.note } as Review;
}

/** After a .bim import: tell watchers which formulas changed and send those items back to draft. */
export async function onFormulasChanged(changed: { id: string; name: string; modelCode: string }[], actor: string) {
  if (!changed.length) return;
  const sb = getSupabaseClient();
  const ids = changed.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await sb
      .from("dax_item_reviews")
      .update({ status: "draft", note: "Formula changed in a .bim import", updated_at: new Date().toISOString() })
      .in("item_id", chunk)
      .eq("status", "reviewed");
    const { data } = await sb.from("dax_watches").select("item_id, user_email").in("item_id", chunk);
    const byItem = new Map<string, string[]>();
    for (const w of data || []) byItem.set(w.item_id, [...(byItem.get(w.item_id) || []), w.user_email]);
    for (const c of changed.filter((x) => byItem.has(x.id))) {
      await notify(byItem.get(c.id)!, { kind: "formula", title: `Formula changed: ${c.name}`, body: `Updated from a .bim import by ${actor}. Check it still means what its definition says.`, link: itemLink(c.id, c.modelCode), actor });
    }
  }
}

export async function listNotifications(email: string) {
  const { data, error } = await getSupabaseClient()
    .from("app_notifications")
    .select("*")
    .eq("user_email", lower(email))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(
    (n): Notification => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, actor: n.actor, createdAt: n.created_at, readAt: n.read_at })
  );
}

export async function markRead(email: string, ids: string[] | "all") {
  let q = getSupabaseClient().from("app_notifications").update({ read_at: new Date().toISOString() }).eq("user_email", lower(email)).is("read_at", null);
  if (ids !== "all") q = q.in("id", ids.slice(0, 200));
  const { error } = await q;
  if (error) throw error;
}
