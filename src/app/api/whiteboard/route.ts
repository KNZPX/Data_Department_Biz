import { NextRequest, NextResponse } from "next/server";
import { getDbWhiteboardBoards, saveDbWhiteboardBoard, deleteDbWhiteboardBoard } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const boards = await getDbWhiteboardBoards();
    return NextResponse.json({
      success: true,
      boards,
      count: boards.length,
    });
  } catch (error: any) {
    console.error("GET /api/whiteboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load whiteboards" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "delete" && body.id) {
      await deleteDbWhiteboardBoard(body.id);
      return NextResponse.json({ success: true, message: "Deleted board" });
    }

    if (body.board) {
      await saveDbWhiteboardBoard(body.board);
      return NextResponse.json({ success: true, message: "Saved board to Supabase" });
    }

    if (Array.isArray(body.boards)) {
      for (const b of body.boards) {
        await saveDbWhiteboardBoard(b);
      }
      return NextResponse.json({ success: true, message: "Saved all boards to Supabase" });
    }

    if (body.id && body.name) {
      await saveDbWhiteboardBoard(body);
      return NextResponse.json({ success: true, message: "Saved board to Supabase" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid board payload provided" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/whiteboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save whiteboard to Supabase" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing board id" }, { status: 400 });
    }

    await deleteDbWhiteboardBoard(id);
    return NextResponse.json({ success: true, message: `Deleted board #${id}` });
  } catch (error: any) {
    console.error("DELETE /api/whiteboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete whiteboard" },
      { status: 500 }
    );
  }
}
