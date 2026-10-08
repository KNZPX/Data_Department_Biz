import { redirect } from "next/navigation";

// EBO now lives on the EBO & OKR page; keep old links working.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  q.set("tab", "ebo");
  redirect(`/okr?${q.toString()}`);
}
