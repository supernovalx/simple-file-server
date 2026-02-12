import { handleTusRequest } from "@/lib/tus-server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Need to disable body parsing for tus to handle the raw stream
export const POST = (req: NextRequest) => handleTusRequest(req);
export const PATCH = (req: NextRequest) => handleTusRequest(req);
export const HEAD = (req: NextRequest) => handleTusRequest(req);
export const OPTIONS = (req: NextRequest) => handleTusRequest(req);
export const DELETE = (req: NextRequest) => handleTusRequest(req);
