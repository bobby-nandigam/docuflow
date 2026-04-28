"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderOpen, Search, MessageSquare,
  Workflow, Plug, Users, Settings, Bell, ChevronRight,
  Upload, FileText, Sparkles, TrendingUp, Clock,
  Star, Filter, Grid, List, Plus, Zap
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { DocumentGrid } from "@/components/documents/DocumentGrid";
import { AIChat } from "@/components/ai/AIChat";
import { SearchBar } from "@/components/search/SearchBar";
import { UploadZone } from "@/components/upload/UploadZone";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";

// Mock data for demo
const MOCK_STATS = [
  { label: "Total Documents", value: "12,483", change: "+124 this week", icon: FileText, color: "brand" },
  { label: "AI Processed", value: "11,901", change: "95.3% coverage", icon: Sparkles, color: "violet" },
  { label: "Active Workflows", value: "47", change: "8 running now", icon: Zap, color: "amber" },
  { label: "Team Members", value: "89", change: "+3 this month", icon: Users, color: "emerald" },
];

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<"dashboard" | "documents" | "chat" | "workflows" | "integrations">("dashboard");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden font-body">
      {/* Sidebar */}
      <Sidebar activeView={activeView} onNavigate={setActiveView} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-surface-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1 max-w-2xl">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search documents, ask AI anything..."
            />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium
                         hover:bg-brand-600 transition-all shadow-brand active:scale-95"
            >
              <Upload size={16} />
              Upload
            </button>
            <button className="relative p-2 hover:bg-surface-100 rounded-xl transition-colors">
              <Bell size={20} className="text-ink-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">JD</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {activeView === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-6"
              >
                {/* Greeting */}
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-display font-bold text-ink-500">
                      Good morning, John 👋
                    </h1>
                    <p className="text-ink-100 mt-1">
                      You have 3 pending approvals and 12 new documents processed by AI.
                    </p>
                  </div>
                  <QuickActions onUpload={() => setShowUpload(true)} onNavigate={setActiveView} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  {MOCK_STATS.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <StatsCard {...stat} />
                    </motion.div>
                  ))}
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Recent Documents */}
                  <div className="col-span-2 bg-white rounded-2xl border border-surface-200 shadow-card">
                    <div className="flex items-center justify-between p-5 border-b border-surface-100">
                      <h2 className="font-display font-semibold text-ink-500">Recent Documents</h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewMode("grid")}
                          className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-brand-50 text-brand-500" : "hover:bg-surface-100 text-ink-100"}`}
                        >
                          <Grid size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode("list")}
                          className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-brand-50 text-brand-500" : "hover:bg-surface-100 text-ink-100"}`}
                        >
                          <List size={16} />
                        </button>
                        <button className="text-sm text-brand-500 font-medium hover:text-brand-600 flex items-center gap-1">
                          View all <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <DocumentGrid viewMode={viewMode} />
                  </div>

                  {/* Sidebar Widgets */}
                  <div className="space-y-4">
                    <RecentActivity />

                    {/* AI Insight Card */}
                    <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 text-white">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={18} />
                        <span className="font-semibold text-sm">AI Insight</span>
                      </div>
                      <p className="text-sm text-brand-100 leading-relaxed">
                        You have 3 contracts expiring in 30 days. AI found action items in 7 recently uploaded documents.
                      </p>
                      <button
                        onClick={() => setActiveView("chat")}
                        className="mt-3 flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white transition-colors"
                      >
                        Ask AI about this <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === "documents" && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <DocumentsView viewMode={viewMode} setViewMode={setViewMode} onUpload={() => setShowUpload(true)} />
              </motion.div>
            )}

            {activeView === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <AIChat />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <UploadZone onClose={() => setShowUpload(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function DocumentsView({ viewMode, setViewMode, onUpload }: any) {
  const [activeFilter, setActiveFilter] = useState("all");
  const filters = ["all", "contract", "invoice", "report", "policy", "technical"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-ink-500">All Documents</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-100 rounded-xl p-1">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  activeFilter === f
                    ? "bg-white text-brand-500 shadow-sm"
                    : "text-ink-100 hover:text-ink-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-surface-200 rounded-xl text-sm text-ink-100 hover:bg-surface-100 transition-colors">
            <Filter size={15} /> Filter
          </button>
          <button
            onClick={onUpload}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-600 transition-all shadow-brand"
          >
            <Plus size={15} /> Upload
          </button>
        </div>
      </div>
      <DocumentGrid viewMode={viewMode} />
    </div>
  );
}
