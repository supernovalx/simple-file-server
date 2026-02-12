import { listFiles } from "@/lib/files";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = await listFiles();
  return NextResponse.json(files);
}
