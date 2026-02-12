import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import path from "path";
import fs from "fs/promises";
import http from "node:http";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || "";
const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

function getUploadDir(): string {
  return path.resolve(UPLOAD_DIR);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "_");
}

function createTusServer(): Server {
  const uploadDir = getUploadDir();

  const server = new Server({
    path: "/api/upload",
    datastore: new FileStore({ directory: uploadDir }),
    maxSize: MAX_SIZE,
    respectForwardedHeaders: true,
    namingFunction(_req, metadata) {
      const originalName = metadata?.filename || "unnamed";
      const sanitized = sanitizeFilename(originalName);
      return `${Date.now()}-${sanitized}`;
    },
    async onIncomingRequest(req) {
      if (!UPLOAD_PASSWORD) {
        throw { status_code: 500, body: "UPLOAD_PASSWORD not configured" };
      }
      const password = req.headers["x-upload-password"];
      if (password !== UPLOAD_PASSWORD) {
        throw { status_code: 401, body: "Invalid upload password" };
      }
    },
    async onUploadFinish(_req, res, upload) {
      // Clean up the .json metadata file created by tus
      const metadataPath = path.join(uploadDir, `${upload.id}.json`);
      try {
        await fs.unlink(metadataPath);
      } catch {
        // ignore if already gone
      }
      return res;
    },
  });

  return server;
}

// Singleton pattern - survives HMR in dev
const globalForTus = globalThis as unknown as { tusServer: Server };
const tusServer = globalForTus.tusServer || createTusServer();
if (process.env.NODE_ENV !== "production") {
  globalForTus.tusServer = tusServer;
}

/**
 * Adapter: converts Next.js Web API Request into Node.js IncomingMessage/ServerResponse
 * and runs it through the tus server, then returns a Web Response.
 */
export async function handleTusRequest(req: NextRequest): Promise<Response> {
  await fs.mkdir(getUploadDir(), { recursive: true });

  const url = new URL(req.url);

  // Convert Web ReadableStream body to Node.js Readable
  let nodeReadable: Readable;
  if (req.body) {
    nodeReadable = Readable.fromWeb(req.body as import("stream/web").ReadableStream);
  } else {
    nodeReadable = new Readable({ read() { this.push(null); } });
  }

  // Build a fake IncomingMessage
  const fakeReq = Object.assign(nodeReadable, {
    method: req.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    connection: { remoteAddress: "127.0.0.1", encrypted: url.protocol === "https:" },
    socket: { remoteAddress: "127.0.0.1", encrypted: url.protocol === "https:" },
  }) as unknown as http.IncomingMessage;

  // Build a fake ServerResponse that captures the output
  return new Promise<Response>((resolve) => {
    const chunks: Buffer[] = [];
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    const eventHandlers: Record<string, Array<() => void>> = {};

    const fakeRes = {
      setHeader(name: string, value: string | number) {
        responseHeaders[name.toLowerCase()] = String(value);
        return this;
      },
      getHeader(name: string) {
        return responseHeaders[name.toLowerCase()];
      },
      hasHeader(name: string) {
        return name.toLowerCase() in responseHeaders;
      },
      removeHeader(name: string) {
        delete responseHeaders[name.toLowerCase()];
      },
      writeHead(code: number, headers?: Record<string, string | number>) {
        statusCode = code;
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            responseHeaders[k.toLowerCase()] = String(v);
          }
        }
        return this;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(code: number) {
        statusCode = code;
      },
      on(event: string, handler: () => void) {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
        return this;
      },
      once(event: string, handler: () => void) {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
        return this;
      },
      emit(event: string) {
        eventHandlers[event]?.forEach((h) => h());
        return true;
      },
      write(chunk: string | Buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        // Fire 'finish' event like a real ServerResponse
        eventHandlers["finish"]?.forEach((h) => h());
        // 204/304 responses must not have a body per the Fetch spec
        const isNullBody = statusCode === 204 || statusCode === 304;
        const body = isNullBody ? null : (chunks.length > 0 ? Buffer.concat(chunks).toString() : null);
        resolve(new Response(body, { status: statusCode, headers: responseHeaders }));
      },
      finished: false,
      headersSent: false,
    } as unknown as http.ServerResponse;

    tusServer.handle(fakeReq, fakeRes).catch((err) => {
      const status = err?.status_code || 500;
      const body = err?.body || "Internal Server Error";
      resolve(new Response(body, { status }));
    });
  });
}

export { getUploadDir };
