import { AlertCircle, ArrowDown, ArrowUp, FileText, Trash2, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { formatBytes, validateFile, type FileValidationOptions } from "@/lib/file-utils";

export interface FileDropzoneProps {
  label: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  validation?: FileValidationOptions;
  files: File[];
  onFilesChange: (files: File[]) => void;
  allowReorder?: boolean;
  disabled?: boolean;
}

export function FileDropzone({
  label,
  description,
  accept,
  multiple = false,
  validation,
  files,
  onFilesChange,
  allowReorder = false,
  disabled = false,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIncomingFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setError(null);

    const nextFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < incoming.length; i++) {
      const f = incoming.item(i);
      if (!f) continue;
      const check = validateFile(f, validation);
      if (!check.valid) {
        if (check.error) errors.push(check.error);
      } else {
        nextFiles.push(f);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(" "));
    }

    if (nextFiles.length > 0) {
      if (multiple) {
        onFilesChange([...files, ...nextFiles]);
      } else {
        const first = nextFiles[0];
        if (first) onFilesChange([first]);
      }
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleIncomingFiles(e.target.files);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleIncomingFiles(e.dataTransfer.files);
  };

  const removeFileAt = (index: number) => {
    setError(null);
    onFilesChange(files.filter((_, idx) => idx !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const copy = [...files];
    const current = copy[index];
    const swap = copy[target];
    if (!current || !swap) return;
    copy[index] = swap;
    copy[target] = current;
    onFilesChange(copy);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-3xl border-2 border-dashed p-6 text-center transition md:p-10 ${
          isDragging
            ? "border-foreground bg-primary/25"
            : "border-border bg-muted/40 hover:border-foreground/50 hover:bg-muted/70"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={onInputChange}
          className="sr-only"
        />
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-card shadow-card">
            <UploadCloud className="h-7 w-7 text-foreground" aria-hidden />
          </span>
          <span className="mt-4 text-lg font-semibold text-foreground md:text-xl">{label}</span>
          {description && (
            <span className="mt-1 max-w-md text-sm text-muted-foreground">{description}</span>
          )}
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
            Choose {multiple ? "files" : "file"}
          </span>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
            className="rounded-lg p-1 hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold text-foreground">
              Selected {files.length === 1 ? "file" : `files (${files.length})`}
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                onFilesChange([]);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear all
            </button>
          </div>
          <ul className="mt-3 divide-y">
            {files.map((file, idx) => (
              <li
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
                    <FileText className="h-4 w-4 text-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {allowReorder && files.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label={`Move ${file.name} up`}
                        disabled={idx === 0}
                        onClick={() => moveFile(idx, -1)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${file.name} down`}
                        disabled={idx === files.length - 1}
                        onClick={() => moveFile(idx, 1)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFileAt(idx)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
