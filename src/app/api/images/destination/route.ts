import { NextResponse } from "next/server";
import { imageProvider } from "@/lib/providers/images";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const result = await imageProvider.searchDestinationImage(name);
    return NextResponse.json(result || { url: null });
  } catch (err) {
    console.error("Failed to fetch image:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
