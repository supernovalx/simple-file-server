import { validateFilePath } from "@/lib/files";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { open } from "fs/promises";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);
  const filePath = validateFilePath(decodedFilename);

  if (!filePath) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileHandle = await open(filePath, "r");
  const stream = fileHandle.readableWebStream() as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${decodedFilename}"`,
      "Content-Length": String(stat.size),
    },
  });
}
