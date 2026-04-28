"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard, FolderOpen, MessageSquare,
  Workflow, Plug, Settings, ChevronRight,
  Sparkles, Users, Shield, BarChart3
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "documents", icon: FolderOpen, label: "Documents" },
  { id: "chat", icon: MessageSquare, label: "Ask AI", badge: "NEW" },
  { id: "workflows", icon: Workflow, label: "Workflows" },
  { id: "integrations", icon: Plug, label: "Integrations" },
];

const BOTTOM_NAV = [
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "team", icon: Users, label: "Team" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: any) => void;
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-surface-200 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-surface-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-brand">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-ink-500 text-lg tracking-tight">DocuFlow</span>
        </div>
        <span className="ml-2 text-xs font-medium bg-brand-50 text-brand-500 px-2 py-0.5 rounded-full">AI</span>
      </div>

      {/* Workspace Switcher */}
      <div className="mx-3 my-3">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 transition-colors group">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-400 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-ink-500 truncate">Acme Corp</div>
            <div className="text-xs text-ink-50 truncate">Enterprise plan</div>
          </div>
          <ChevronRight size={14} className="text-ink-50 group-hover:text-ink-100 transition-colors" />
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-ink-50 uppercase tracking-wider px-3 py-2 mt-1">Main</p>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            {...item}
            isActive={activeView === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        <p className="text-xs font-semibold text-ink-50 uppercase tracking-wider px-3 py-2 mt-4">Spaces</p>
        {[
          { label: "Product Docs", icon: "📦", count: 234 },
          { label: "Legal & Contracts", icon: "⚖️", count: 89 },
          { label: "Marketing", icon: "📣", count: 156 },
        ].map((space) => (
          <button
            key={space.label}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-ink-400 hover:bg-surface-50 hover:text-ink-500 transition-all group text-left"
          >
            <span className="text-base">{space.icon}</span>
            <span className="flex-1 text-sm font-medium truncate">{space.label}</span>
            <span className="text-xs text-ink-50 bg-surface-100 px-1.5 py-0.5 rounded-md">{space.count}</span>
          </button>
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 py-3 border-t border-surface-200 space-y-0.5">
        {BOTTOM_NAV.map((item) => (
          <NavItem
            key={item.id}
            {...item}
            isActive={activeView === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function NavItem({ id, icon: Icon, label, badge, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
        isActive
          ? "bg-brand-50 text-brand-600"
          : "text-ink-400 hover:bg-surface-50 hover:text-ink-500"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute inset-0 bg-brand-50 rounded-xl"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon size={18} className="relative flex-shrink-0" />
      <span className="relative flex-1 text-sm font-medium">{label}</span>
      {badge && (
        <span className="relative text-xs font-bold bg-brand-500 text-white px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
