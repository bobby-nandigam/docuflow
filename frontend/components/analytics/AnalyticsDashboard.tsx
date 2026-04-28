"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, FileText, Sparkles, Users, Zap, ArrowUpRight } from "lucide-react";

const UPLOAD_DATA = [
  { day: "Mon", uploads: 42, aiProcessed: 39 },
  { day: "Tue", uploads: 78, aiProcessed: 74 },
  { day: "Wed", uploads: 65, aiProcessed: 63 },
  { day: "Thu", uploads: 91, aiProcessed: 89 },
  { day: "Fri", uploads: 123, aiProcessed: 121 },
  { day: "Sat", uploads: 34, aiProcessed: 34 },
  { day: "Sun", uploads: 28, aiProcessed: 28 },
];

const CATEGORY_DATA = [
  { name: "Contracts", value: 28, color: "#8b5cf6" },
  { name: "Reports", value: 22, color: "#3b82f6" },
  { name: "Financial", value: 18, color: "#10b981" },
  { name: "HR", value: 14, color: "#f59e0b" },
  { name: "Technical", value: 12, color: "#ef4444" },
  { name: "Other", value: 6, color: "#6b7280" },
];

const AI_USAGE_DATA = [
  { week: "W1", rag: 240, classify: 180, summarize: 320 },
  { week: "W2", rag: 380, classify: 220, summarize: 410 },
  { week: "W3", rag: 310, classify: 195, summarize: 375 },
  { week: "W4", rag: 520, classify: 310, summarize: 490 },
];

const KPI_ITEMS = [
  { label: "Search Accuracy", value: "94.2%", change: "+2.1%", icon: Sparkles, good: true },
  { label: "Avg Process Time", value: "3.2s", change: "-0.8s", icon: Zap, good: true },
  { label: "Active Users", value: "67", change: "+8", icon: Users, good: true },
  { label: "Storage Used", value: "142 GB", change: "+12 GB", icon: FileText, good: null },
];

export function AnalyticsDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-ink-500">Analytics</h1>
        <p className="text-sm text-ink-100 mt-1">Platform usage and AI performance metrics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_ITEMS.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-white border border-surface-200 rounded-2xl p-4 shadow-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
                  <Icon size={18} className="text-brand-500" />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  kpi.good === true ? "bg-emerald-50 text-emerald-600" :
                  kpi.good === false ? "bg-red-50 text-red-600" :
                  "bg-surface-100 text-ink-100"
                }`}>
                  <ArrowUpRight size={10} />
                  {kpi.change}
                </span>
              </div>
              <div className="text-2xl font-display font-bold text-ink-500">{kpi.value}</div>
              <div className="text-xs text-ink-100 mt-1">{kpi.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Upload Activity */}
        <div className="col-span-2 bg-white border border-surface-200 rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-semibold text-ink-500">Document Activity</h3>
              <p className="text-xs text-ink-100 mt-0.5">Uploads vs AI processed this week</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-brand-500 rounded-full inline-block" />Uploads</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-emerald-400 rounded-full inline-block" />AI Processed</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={UPLOAD_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3355ee" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3355ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8892b4" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#8892b4" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4e8f4", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }} />
              <Area type="monotone" dataKey="uploads" stroke="#3355ee" strokeWidth={2} fill="url(#uploadGrad)" />
              <Area type="monotone" dataKey="aiProcessed" stroke="#10b981" strokeWidth={2} fill="url(#aiGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border border-surface-200 rounded-2xl shadow-card p-5">
          <h3 className="font-display font-semibold text-ink-500 mb-1">Document Categories</h3>
          <p className="text-xs text-ink-100 mb-4">AI auto-classification breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={CATEGORY_DATA} cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value" strokeWidth={0}>
                {CATEGORY_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4e8f4" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {CATEGORY_DATA.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-ink-400 flex-1">{item.name}</span>
                <span className="text-xs font-medium text-ink-500">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Usage */}
      <div className="bg-white border border-surface-200 rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display font-semibold text-ink-500">AI Feature Usage</h3>
            <p className="text-xs text-ink-100 mt-0.5">API calls by feature per week</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-brand-500 rounded-sm inline-block" />Ask AI (RAG)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-violet-500 rounded-sm inline-block" />Classify</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-amber-400 rounded-sm inline-block" />Summarize</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={AI_USAGE_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#8892b4" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#8892b4" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4e8f4" }} />
            <Bar dataKey="rag" fill="#3355ee" radius={[4, 4, 0, 0]} />
            <Bar dataKey="classify" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="summarize" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
