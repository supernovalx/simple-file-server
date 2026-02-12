"use client";

import { useState, useRef, useEffect } from "react";
import { Upload as TusUpload } from "tus-js-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadSection() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [speed, setSpeed] = useState("");
  const uploadRef = useRef<TusUpload | null>(null);
  const lastProgressRef = useRef<{ time: number; bytes: number } | null>(null);

  // Restore password from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("upload-password");
    if (saved) setPassword(saved);
  }, []);

  const savePassword = (val: string) => {
    setPassword(val);
    sessionStorage.setItem("upload-password", val);
  };

  const startUpload = () => {
    if (!file) return;
    if (!password) {
      toast.error("Enter the upload password");
      return;
    }

    setUploading(true);
    setProgress(0);
    setSpeed("");
    lastProgressRef.current = null;

    const upload = new TusUpload(file, {
      endpoint: "/api/upload",
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: file.name,
        filetype: file.type || "application/octet-stream",
      },
      headers: {
        "X-Upload-Password": password,
      },
      onProgress(bytesUploaded, bytesTotal) {
        const pct = (bytesUploaded / bytesTotal) * 100;
        setProgress(pct);

        // Calculate speed
        const now = Date.now();
        const last = lastProgressRef.current;
        if (last && now - last.time > 500) {
          const elapsed = (now - last.time) / 1000;
          const bytes = bytesUploaded - last.bytes;
          const bps = bytes / elapsed;
          if (bps > 1024 * 1024) {
            setSpeed(`${(bps / 1024 / 1024).toFixed(1)} MB/s`);
          } else {
            setSpeed(`${(bps / 1024).toFixed(0)} KB/s`);
          }
          lastProgressRef.current = { time: now, bytes: bytesUploaded };
        } else if (!last) {
          lastProgressRef.current = { time: now, bytes: bytesUploaded };
        }
      },
      onSuccess() {
        setUploading(false);
        setFile(null);
        setProgress(0);
        setSpeed("");
        toast.success(`Uploaded ${file.name}`);
        window.__refreshFileList?.();
      },
      onError(error) {
        setUploading(false);
        setSpeed("");
        const msg = error.message || "Upload failed";
        if (msg.includes("401") || msg.includes("Invalid upload password")) {
          toast.error("Invalid upload password");
        } else {
          toast.error(msg);
        }
      },
    });

    uploadRef.current = upload;
    upload.start();
  };

  const cancelUpload = () => {
    uploadRef.current?.abort();
    setUploading(false);
    setProgress(0);
    setSpeed("");
    toast.info("Upload cancelled");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upload File</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Upload password"
            value={password}
            onChange={(e) => savePassword(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="file" className="text-sm font-medium">
            File
          </label>
          <Input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={uploading}
          />
          {file && !uploading && (
            <p className="text-sm text-muted-foreground">
              {file.name} ({formatSize(file.size)})
            </p>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress.toFixed(1)}%</span>
              {speed && <span>{speed}</span>}
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="flex gap-2">
          {!uploading ? (
            <Button onClick={startUpload} disabled={!file || !password}>
              <Upload />
              Upload
            </Button>
          ) : (
            <Button variant="destructive" onClick={cancelUpload}>
              <X />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
