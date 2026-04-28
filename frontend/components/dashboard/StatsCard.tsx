"use client";

import { motion } from "framer-motion";
import { FileText, Sparkles, Zap, Users, Clock, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

// ─── Stats Card ───────────────────────────────────────────────

const ICON_MAP: Record<string, any> = { FileText, Sparkles, Zap, Users };
const COLOR_MAP: Record<string, { bg: string; icon: string; text: string; badge: string }> = {
  brand:   { bg: "bg-brand-50",   icon: "text-brand-500",   text: "text-brand-700",   badge: "bg-brand-100 text-brand-700" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  text: "text-violet-700",  badge: "bg-violet-100 text-violet-700" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   text: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
};

export function StatsCard({ label, value, change, icon, color }: {
  label: string; value: string; change: string; icon: any; color: string;
}) {
  const Icon = icon;
  const c = COLOR_MAP[color] || COLOR_MAP.brand;

  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-5 hover:shadow-card-hover transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={c.icon} />
        </div>
        <TrendingUp size={16} className="text-emerald-400" />
      </div>
      <div className="text-2xl font-display font-bold text-ink-500 mb-1">{value}</div>
      <div className="text-sm text-ink-100 mb-2">{label}</div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>{change}</span>
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────

const ACTIVITIES = [
  { icon: FileText, color: "text-blue-500 bg-blue-50", action: "Document uploaded", subject: "Q4 Report.pdf", time: "2m ago" },
  { icon: Sparkles, color: "text-brand-500 bg-brand-50", action: "AI analyzed", subject: "Contract Draft.docx", time: "15m ago" },
  { icon: CheckCircle, color: "text-emerald-500 bg-emerald-50", action: "Approved", subject: "Marketing Brief", time: "1h ago" },
  { icon: AlertCircle, color: "text-amber-500 bg-amber-50", action: "Review needed", subject: "Legal Agreement", time: "2h ago" },
  { icon: Users, color: "text-violet-500 bg-violet-50", action: "Shared with team", subject: "Product Roadmap", time: "3h ago" },
];

export function RecentActivity() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card">
      <div className="p-4 border-b border-surface-100">
        <h3 className="font-display font-semibold text-ink-500 text-sm">Recent Activity</h3>
      </div>
      <div className="p-2">
        {ACTIVITIES.map((activity, i) => {
          const Icon = activity.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer"
            >
              <div className={`w-7 h-7 rounded-lg ${activity.color.split(" ")[1]} flex items-center justify-center flex-shrink-0`}>
                <Icon size={13} className={activity.color.split(" ")[0]} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-500 truncate">{activity.action}</p>
                <p className="text-xs text-ink-50 truncate">{activity.subject}</p>
              </div>
              <span className="text-xs text-ink-50 flex-shrink-0 flex items-center gap-1">
                <Clock size={10} />
                {activity.time}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────

export function QuickActions({ onUpload, onNavigate }: { onUpload: () => void; onNavigate: (v: any) => void }) {
  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onUpload}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-xl text-sm text-ink-400 hover:border-brand-300 hover:text-brand-500 transition-all shadow-card"
      >
        <FileText size={15} /> New Document
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate("chat")}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-medium shadow-brand hover:shadow-glow transition-all"
      >
        <Sparkles size={15} /> Ask AI
      </motion.button>
    </div>
  );
}
