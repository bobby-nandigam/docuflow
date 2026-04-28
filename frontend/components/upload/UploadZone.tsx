"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, CheckCircle, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  progress: number;
}

interface UploadZoneProps {
  onClose: () => void;
}

export function UploadZone({ onClose }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: "pending" as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);

    // Simulate upload
    newFiles.forEach(f => simulateUpload(f.id, setFiles));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxSize: 500 * 1024 * 1024,
  });

  const allDone = files.length > 0 && files.every(f => f.status === "done" || f.status === "error");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <div>
            <h2 className="font-display font-bold text-ink-500 text-lg">Upload Documents</h2>
            <p className="text-sm text-ink-100 mt-0.5">AI will automatically process and analyze your files</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <X size={18} className="text-ink-100" />
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6">
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
              isDragActive
                ? "border-brand-400 bg-brand-50"
                : "border-surface-300 hover:border-brand-300 hover:bg-surface-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${
              isDragActive ? "bg-brand-100" : "bg-surface-100"
            }`}>
              <Upload size={24} className={isDragActive ? "text-brand-500" : "text-ink-100"} />
            </div>
            {isDragActive ? (
              <p className="text-brand-600 font-semibold">Drop files here...</p>
            ) : (
              <>
                <p className="font-semibold text-ink-500 mb-1">Drag & drop files here</p>
                <p className="text-sm text-ink-100 mb-3">or click to browse your computer</p>
                <p className="text-xs text-ink-50">PDF, DOCX, XLSX, PPTX, TXT, CSV, Images • Max 500MB each</p>
              </>
            )}
          </div>

          {/* AI Feature Notice */}
          <div className="mt-4 flex items-start gap-3 bg-brand-50 rounded-xl p-3">
            <Sparkles size={16} className="text-brand-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-brand-700">AI Processing Enabled</p>
              <p className="text-xs text-brand-600 mt-0.5">
                Documents will be automatically classified, summarized, tagged, and made searchable via AI.
              </p>
            </div>
          </div>
        </div>

        {/* File List */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto"
            >
              {files.map(f => (
                <FileRow key={f.id} uploadFile={f} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-surface-200 bg-surface-50">
          <p className="text-sm text-ink-100">
            {files.length > 0
              ? `${files.filter(f => f.status === "done").length}/${files.length} files uploaded`
              : "No files selected"
            }
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-ink-400 hover:bg-surface-200 rounded-xl transition-colors">
              {allDone ? "Close" : "Cancel"}
            </button>
            {files.length === 0 && (
              <button className="px-4 py-2 text-sm bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors">
                Choose Files
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FileRow({ uploadFile }: { uploadFile: UploadFile }) {
  const { file, status, progress } = uploadFile;
  const sizeStr = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${(file.size / 1024).toFixed(0)} KB`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 bg-white border border-surface-200 rounded-xl p-3"
    >
      <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <FileText size={16} className="text-ink-100" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-500 truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-ink-50">{sizeStr}</p>
          {status === "uploading" && (
            <div className="flex-1 bg-surface-200 rounded-full h-1">
              <div
                className="bg-brand-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {status === "processing" && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <Sparkles size={10} />AI processing...
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        {status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-surface-300" />}
        {status === "uploading" && <Loader2 size={16} className="text-brand-500 animate-spin" />}
        {status === "processing" && <Sparkles size={16} className="text-amber-500" />}
        {status === "done" && <CheckCircle size={16} className="text-emerald-500" />}
        {status === "error" && <AlertCircle size={16} className="text-red-500" />}
      </div>
    </motion.div>
  );
}

async function simulateUpload(fileId: string, setFiles: Function) {
  // Simulate upload progress
  setFiles((prev: UploadFile[]) => prev.map(f =>
    f.id === fileId ? { ...f, status: "uploading" } : f
  ));

  for (let progress = 0; progress <= 100; progress += 20) {
    await new Promise(r => setTimeout(r, 200));
    setFiles((prev: UploadFile[]) => prev.map(f =>
      f.id === fileId ? { ...f, progress } : f
    ));
  }

  // Simulate AI processing
  setFiles((prev: UploadFile[]) => prev.map(f =>
    f.id === fileId ? { ...f, status: "processing" } : f
  ));

  await new Promise(r => setTimeout(r, 2000));

  setFiles((prev: UploadFile[]) => prev.map(f =>
    f.id === fileId ? { ...f, status: "done" } : f
  ));
}
