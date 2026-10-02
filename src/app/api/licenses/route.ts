import { requireModule } from "@/lib/guard";
import { NextRequest, NextResponse } from "next/server";
import { getDbLicenses, saveDbLicense, deleteDbLicense } from "@/lib/db";
import { normalizeLicense, type LicenseInput } from "@/lib/licenseTypes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const licenses = await getDbLicenses();
    return NextResponse.json({ licenses });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch licenses" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const _g = await requireModule("licenses.edit");
  if (_g.deny) return _g.deny;
  try {
    const body = (await req.json()) as LicenseInput;
    const normalized = normalizeLicense(body);
    const saved = await saveDbLicense(normalized, _g.user.name || _g.user.email);
    return NextResponse.json({ license: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save license" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const _g = await requireModule("licenses.edit");
  if (_g.deny) return _g.deny;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }
    await deleteDbLicense(id, _g.user.name || _g.user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete license" },
      { status: 500 }
    );
  }
}
