"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FileInfo {
  name: string;
  size: number;
  uploadedAt: string;
  downloadUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function FileList() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        setFiles(await res.json());
      }
    } catch {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Expose refresh for parent components
  useEffect(() => {
    window.__refreshFileList = fetchFiles;
    return () => {
      delete window.__refreshFileList;
    };
  }, [fetchFiles]);

  const copyUrl = async (downloadUrl: string, fileName: string) => {
    const fullUrl = `${window.location.origin}${downloadUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success(`Copied URL for ${fileName}`);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Files</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {files.length === 0 && !loading ? (
          <p className="text-muted-foreground text-center py-8">No files uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Size</TableHead>
                <TableHead className="w-[180px]">Uploaded</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.name}>
                  <TableCell className="font-medium break-all">{file.name}</TableCell>
                  <TableCell>{formatSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <a
                        href={file.downloadUrl}
                        download
                        className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyUrl(file.downloadUrl, file.name)}
                      >
                        <Copy />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Type declaration for the global refresh function
declare global {
  interface Window {
    __refreshFileList?: () => void;
  }
}
