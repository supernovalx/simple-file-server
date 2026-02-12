import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "./tus-server";

export interface FileInfo {
  name: string;
  size: number;
  uploadedAt: string;
  downloadUrl: string;
}

export async function listFiles(): Promise<FileInfo[]> {
  const uploadDir = getUploadDir();

  try {
    const entries = await fs.readdir(uploadDir);
    const files: FileInfo[] = [];

    for (const entry of entries) {
      // Skip tus metadata/lock files
      if (entry.endsWith(".json") || entry.endsWith(".lock")) continue;

      const filePath = path.join(uploadDir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) continue;

        files.push({
          name: entry,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
          downloadUrl: `/api/download/${encodeURIComponent(entry)}`,
        });
      } catch {
        // skip files we can't stat
      }
    }

    // Sort newest first
    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return files;
  } catch {
    return [];
  }
}

export function validateFilePath(filename: string): string | null {
  const uploadDir = getUploadDir();
  const resolved = path.resolve(uploadDir, filename);

  // Path traversal prevention
  if (!resolved.startsWith(uploadDir + path.sep) && resolved !== uploadDir) {
    return null;
  }

  return resolved;
}
