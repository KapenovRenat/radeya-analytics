"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, CheckCircle, XCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileItem {
  file: File;
  dateRange: string | null;
}

interface UploadResult {
  filename: string;
  weekStart?: string;
  weekEnd?: string;
  isMonthlyTotal?: boolean;
  upserted?: number;
  error?: string;
}

function parseDateFromFilename(name: string): string | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return `${m[1]} — ${m[2]}`;
}

export function UploadCampaignsClient({ storeId }: { storeId: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".csv"),
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.file.name));
      const next = arr
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ file: f, dateRange: parseDateFromFilename(f.name) }));
      return [...prev, ...next];
    });
    setResults(null);
  }, []);

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.file.name !== name));
    setResults(null);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setResults(null);

    const formData = new FormData();
    files.forEach(({ file }) => formData.append("files", file));

    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/upload/campaigns`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(data.results ?? []);
      const errors = new Set(
        (data.results as UploadResult[])
          .filter((r) => r.error)
          .map((r) => r.filename),
      );
      setFiles((prev) => prev.filter((f) => errors.has(f.file.name)));
    } catch {
      setResults([{ filename: "—", error: "Ошибка сети" }]);
    } finally {
      setUploading(false);
    }
  };

  const successCount = results?.filter((r) => !r.error).length ?? 0;
  const errorCount = results?.filter((r) => r.error).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Instructions */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[12px] text-[var(--text-dim)]">
        <p className="font-medium text-[var(--text)]">Как получить файлы из Kaspi кабинета:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>Открой Kaspi Merchant Cabinet → Реклама → Статистика</li>
          <li>Выбери период (неделя) → нажми «Экспорт» → сохрани CSV</li>
          <li>Повтори для каждой недели и итогового месяца</li>
          <li>Название файла должно содержать даты: <code className="rounded bg-black/30 px-1">2026-05-18 - 2026-05-24</code></li>
        </ol>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-12 transition-colors",
          dragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--surface)]",
        )}
      >
        <Upload className="h-8 w-8 text-[var(--text-dim)]" />
        <div className="text-center">
          <p className="text-[14px] font-medium text-[var(--text)]">
            Перетащи CSV файлы сюда
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            или кликни чтобы выбрать · только .csv · можно несколько
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
            Файлы к загрузке ({files.length})
          </div>
          {files.map(({ file, dateRange }) => (
            <div
              key={file.name}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[var(--text)]">
                  {file.name}
                </p>
                {dateRange ? (
                  <p className="text-[11px] text-[var(--text-dim)]">📅 {dateRange}</p>
                ) : (
                  <p className="text-[11px] text-[var(--red)]">
                    ⚠ Не удалось определить период из названия
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                className="shrink-0 rounded p-0.5 text-[var(--text-dim)] hover:bg-white/10 hover:text-[var(--text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={uploading}
          className="self-start"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading
            ? "Загружаем..."
            : `Загрузить ${files.length} файл${files.length > 1 ? "а" : ""}`}
        </Button>
      )}

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-[12px]">
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-[var(--emerald)]">
                <CheckCircle className="h-3.5 w-3.5" />
                {successCount} загружено
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-[var(--red)]">
                <XCircle className="h-3.5 w-3.5" />
                {errorCount} ошибок
              </span>
            )}
          </div>

          {results.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-[var(--radius)] border px-3 py-2 text-[12px]",
                r.error
                  ? "border-[var(--red)]/30 bg-[var(--red-soft)]"
                  : "border-[var(--emerald)]/30 bg-[var(--emerald-soft)]/30",
              )}
            >
              {r.error ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--red)]" />
              ) : (
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--emerald)]" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-[var(--text)] truncate">{r.filename}</p>
                {r.error ? (
                  <p className="text-[var(--red)]">{r.error}</p>
                ) : (
                  <p className="text-[var(--text-dim)]">
                    {r.isMonthlyTotal ? "📊 Итог за месяц · " : "📅 Неделя · "}
                    {r.upserted} кампаний
                  </p>
                )}
              </div>
            </div>
          ))}

          {successCount > 0 && (
            <a
              href={`/stores/${storeId}/ad/campaigns`}
              className="self-start text-[12px] text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
            >
              Перейти к кампаниям →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
