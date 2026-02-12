import { FileList } from "@/components/file-list";
import { UploadSection } from "@/components/upload-section";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">File Server</h1>
        <UploadSection />
        <FileList />
      </div>
    </main>
  );
}
