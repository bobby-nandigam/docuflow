"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, FileImage, FileSpreadsheet, File, MoreHorizontal,
  Download, Share2, Trash2, Eye, Star, Clock, Sparkles, Tag
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const MOCK_DOCS = [
  {
    id: "1", name: "Q4 2024 Financial Report.pdf", type: "pdf", size: "2.4 MB",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    category: "financial", tags: ["quarterly", "finance", "report"],
    summary: "Quarterly financial overview showing 23% YoY growth...",
    starred: true, aiProcessed: true,
  },
  {
    id: "2", name: "Product Roadmap 2025.pptx", type: "pptx", size: "8.1 MB",
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    category: "technical", tags: ["product", "roadmap", "planning"],
    summary: "Strategic product roadmap covering Q1-Q4 initiatives...",
    starred: false, aiProcessed: true,
  },
  {
    id: "3", name: "Client Contract - Acme Corp.docx", type: "docx", size: "1.2 MB",
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    category: "contract", tags: ["legal", "contract", "client"],
    summary: "Service agreement with 12-month term expiring March 2025...",
    starred: true, aiProcessed: true,
  },
  {
    id: "4", name: "Sales Pipeline Data.xlsx", type: "xlsx", size: "4.7 MB",
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    category: "financial", tags: ["sales", "pipeline", "crm"],
    summary: "CRM export with 1,240 opportunities totaling $4.2M...",
    starred: false, aiProcessed: true,
  },
  {
    id: "5", name: "Employee Handbook 2024.pdf", type: "pdf", size: "3.8 MB",
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    category: "hr", tags: ["hr", "policy", "employees"],
    summary: "Updated company policies including remote work and PTO...",
    starred: false, aiProcessed: true,
  },
  {
    id: "6", name: "Marketing Campaign Brief.docx", type: "docx", size: "0.9 MB",
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    category: "marketing", tags: ["marketing", "campaign", "brief"],
    summary: "Summer campaign targeting enterprise segment with budget...",
    starred: false, aiProcessed: false,
  },
];

const FILE_ICONS: Record<string, any> = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50" },
  docx: { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
  pptx: { icon: File, color: "text-orange-500", bg: "bg-orange-50" },
  xlsx: { icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-50" },
  default: { icon: File, color: "text-ink-100", bg: "bg-surface-100" },
};

const CATEGORY_COLORS: Record<string, string> = {
  financial: "bg-emerald-50 text-emerald-700",
  contract: "bg-violet-50 text-violet-700",
  technical: "bg-blue-50 text-blue-700",
  hr: "bg-amber-50 text-amber-700",
  marketing: "bg-pink-50 text-pink-700",
};

interface DocumentGridProps {
  viewMode?: "grid" | "list";
}

export function DocumentGrid({ viewMode = "grid" }: DocumentGridProps) {
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);
  const [docs, setDocs] = useState(MOCK_DOCS);

  const toggleStar = (id: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, starred: !d.starred } : d));
  };

  if (viewMode === "list") {
    return (
      <div className="divide-y divide-surface-100">
        {docs.map((doc, i) => (
          <ListRow key={doc.id} doc={doc} index={i} onStar={() => toggleStar(doc.id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 p-5">
      {docs.map((doc, i) => (
        <DocCard
          key={doc.id}
          doc={doc}
          index={i}
          isHovered={hoveredDoc === doc.id}
          onHover={() => setHoveredDoc(doc.id)}
          onLeave={() => setHoveredDoc(null)}
          onStar={() => toggleStar(doc.id)}
        />
      ))}
    </div>
  );
}

function DocCard({ doc, index, isHovered, onHover, onLeave, onStar }: any) {
  const fileType = FILE_ICONS[doc.type] || FILE_ICONS.default;
  const Icon = fileType.icon;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`relative bg-white border rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
        isHovered ? "border-brand-200 shadow-card-hover -translate-y-0.5" : "border-surface-200 shadow-card"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 ${fileType.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={fileType.color} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-ink-500 truncate leading-tight">{doc.name}</h3>
          <p className="text-xs text-ink-50 mt-0.5">{doc.size}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onStar(); }}
            className={`p-1 rounded-lg transition-colors ${doc.starred ? "text-amber-400" : "text-surface-300 hover:text-amber-300"}`}
          >
            <Star size={14} fill={doc.starred ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 rounded-lg hover:bg-surface-100 text-ink-50 hover:text-ink-100 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {doc.aiProcessed && doc.summary && (
        <div className="mb-3">
          <p className="text-xs text-ink-100 line-clamp-2 leading-relaxed">{doc.summary}</p>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[doc.category] || "bg-surface-100 text-ink-100"}`}>
          {doc.category}
        </span>
        {doc.tags.slice(0, 2).map((tag: string) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-ink-100">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-ink-50">
          <Clock size={11} />
          {formatDistanceToNow(doc.updatedAt, { addSuffix: true })}
        </div>
        {doc.aiProcessed ? (
          <div className="flex items-center gap-1 text-xs text-brand-500">
            <Sparkles size={11} />
            AI analyzed
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <Sparkles size={11} />
            Processing...
          </div>
        )}
      </div>

      {/* Hover Actions */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-x-4 bottom-4 flex gap-2 justify-center"
        >
          <ActionButton icon={Eye} label="Preview" />
          <ActionButton icon={Download} label="Download" />
          <ActionButton icon={Share2} label="Share" />
        </motion.div>
      )}
    </motion.div>
  );
}

function ActionButton({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex items-center gap-1.5 bg-ink-500/90 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-ink-400 transition-colors backdrop-blur-sm">
      <Icon size={12} />
      {label}
    </button>
  );
}

function ListRow({ doc, index, onStar }: any) {
  const fileType = FILE_ICONS[doc.type] || FILE_ICONS.default;
  const Icon = fileType.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-4 px-5 py-3 hover:bg-surface-50 transition-colors cursor-pointer group"
    >
      <div className={`w-8 h-8 ${fileType.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={fileType.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-500 truncate">{doc.name}</p>
        <p className="text-xs text-ink-50 truncate">{doc.summary}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[doc.category] || "bg-surface-100 text-ink-100"}`}>
          {doc.category}
        </span>
        <span className="text-xs text-ink-50 w-16 text-right">{doc.size}</span>
        <span className="text-xs text-ink-50 w-24 text-right">{formatDistanceToNow(doc.updatedAt, { addSuffix: true })}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onStar(); }} className={`p-1 rounded ${doc.starred ? "text-amber-400" : "text-ink-50 hover:text-amber-300"}`}>
            <Star size={14} fill={doc.starred ? "currentColor" : "none"} />
          </button>
          <button className="p-1 rounded hover:bg-surface-200 text-ink-50"><Download size={14} /></button>
          <button className="p-1 rounded hover:bg-surface-200 text-ink-50"><Share2 size={14} /></button>
        </div>
      </div>
    </motion.div>
  );
}
