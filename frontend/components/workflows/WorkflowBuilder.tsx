"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Zap, Bell, CheckCircle, GitBranch, Tag,
  Webhook, Clock, MoveRight, Trash2, ChevronDown,
  Play, Pause, MoreHorizontal, CheckSquare
} from "lucide-react";

const TRIGGER_OPTIONS = [
  { value: "document.uploaded", label: "Document Uploaded", icon: "📄" },
  { value: "document.updated", label: "Document Updated", icon: "✏️" },
  { value: "approval.requested", label: "Approval Requested", icon: "⏳" },
  { value: "schedule.cron", label: "Scheduled", icon: "🕐" },
];

const STEP_OPTIONS = [
  { type: "notification", label: "Send Notification", icon: Bell, color: "bg-blue-50 text-blue-600 border-blue-200" },
  { type: "approval", label: "Request Approval", icon: CheckSquare, color: "bg-violet-50 text-violet-600 border-violet-200" },
  { type: "condition", label: "Condition (IF/THEN)", icon: GitBranch, color: "bg-amber-50 text-amber-600 border-amber-200" },
  { type: "tag", label: "Add Tags", icon: Tag, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { type: "webhook", label: "Call Webhook", icon: Webhook, color: "bg-orange-50 text-orange-600 border-orange-200" },
  { type: "delay", label: "Wait / Delay", icon: Clock, color: "bg-surface-100 text-ink-400 border-surface-200" },
];

const MOCK_WORKFLOWS = [
  {
    id: "1", name: "Auto-classify Contracts", active: true, runs: 1240,
    trigger: "document.uploaded",
    steps: ["condition", "tag", "notification"],
    lastRun: "2 min ago",
  },
  {
    id: "2", name: "Approval Pipeline", active: true, runs: 89,
    trigger: "document.uploaded",
    steps: ["approval", "notification"],
    lastRun: "1 hr ago",
  },
  {
    id: "3", name: "Weekly Digest", active: false, runs: 52,
    trigger: "schedule.cron",
    steps: ["notification"],
    lastRun: "7 days ago",
  },
];

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState(MOCK_WORKFLOWS);
  const [building, setBuilding] = useState(false);
  const [newSteps, setNewSteps] = useState<string[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState("document.uploaded");

  const addStep = (type: string) => setNewSteps(prev => [...prev, type]);
  const removeStep = (i: number) => setNewSteps(prev => prev.filter((_, idx) => idx !== i));
  const toggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-ink-500">Workflow Engine</h1>
          <p className="text-sm text-ink-100 mt-1">Automate document processes with no-code workflows</p>
        </div>
        <button
          onClick={() => setBuilding(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-600 transition-all shadow-brand"
        >
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Workflows", value: "47", icon: "⚡" },
          { label: "Runs This Month", value: "12,483", icon: "▶️" },
          { label: "Time Saved", value: "~240 hrs", icon: "⏱️" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-surface-200 rounded-2xl p-4 shadow-card">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-xl font-display font-bold text-ink-500">{stat.value}</div>
            <div className="text-sm text-ink-100">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow List */}
      <div className="bg-white border border-surface-200 rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100">
          <h2 className="font-display font-semibold text-ink-500">Workflows</h2>
        </div>
        <div className="divide-y divide-surface-100">
          {workflows.map((wf, i) => (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 transition-colors"
            >
              {/* Toggle */}
              <button
                onClick={() => toggleWorkflow(wf.id)}
                className={`relative w-10 h-5 rounded-full transition-colors ${wf.active ? "bg-brand-500" : "bg-surface-300"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${wf.active ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-ink-500">{wf.name}</p>
                  {wf.active && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-ink-50">
                    Trigger: {TRIGGER_OPTIONS.find(t => t.value === wf.trigger)?.label}
                  </span>
                  <span className="text-xs text-ink-50">{wf.steps.length} steps</span>
                  <span className="text-xs text-ink-50">{wf.runs} runs</span>
                </div>
              </div>

              {/* Steps Preview */}
              <div className="flex items-center gap-1.5">
                {wf.steps.map((step, j) => {
                  const opt = STEP_OPTIONS.find(s => s.type === step);
                  const Icon = opt?.icon || Zap;
                  return (
                    <div key={j} className="flex items-center gap-1">
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs ${opt?.color || ""}`}>
                        <Icon size={13} />
                      </div>
                      {j < wf.steps.length - 1 && <MoveRight size={12} className="text-surface-300" />}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 text-xs text-ink-50">
                <Clock size={11} />
                {wf.lastRun}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors">
                  <Play size={13} className="text-ink-100" />
                </button>
                <button className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors">
                  <MoreHorizontal size={13} className="text-ink-100" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Workflow Builder Modal */}
      <AnimatePresence>
        {building && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setBuilding(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-surface-200 flex items-center justify-between">
                <h2 className="font-display font-bold text-ink-500 text-lg">Build Workflow</h2>
                <button onClick={() => setBuilding(false)} className="p-2 hover:bg-surface-100 rounded-xl">✕</button>
              </div>

              <div className="p-6 space-y-6">
                {/* Workflow Name */}
                <div>
                  <label className="text-sm font-medium text-ink-400 block mb-2">Workflow Name</label>
                  <input
                    className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-300 transition-colors"
                    placeholder="e.g. Auto-classify contracts"
                  />
                </div>

                {/* Trigger */}
                <div>
                  <label className="text-sm font-medium text-ink-400 block mb-2">
                    <Zap size={14} className="inline mr-1 text-amber-500" />
                    Trigger — When should this run?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRIGGER_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setSelectedTrigger(t.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm text-left transition-all ${
                          selectedTrigger === t.value
                            ? "border-brand-300 bg-brand-50 text-brand-600"
                            : "border-surface-200 hover:border-surface-300"
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span className="font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <label className="text-sm font-medium text-ink-400 block mb-2">
                    Steps — What should happen?
                  </label>
                  <div className="space-y-2">
                    {newSteps.map((stepType, i) => {
                      const opt = STEP_OPTIONS.find(s => s.type === stepType);
                      const Icon = opt?.icon || Zap;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          {i > 0 && <div className="w-0.5 h-4 bg-surface-200 ml-3 -mt-4 mb-0" />}
                          <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${opt?.color}`}>
                            <Icon size={15} />
                            <span className="text-sm font-medium">{opt?.label}</span>
                            <button onClick={() => removeStep(i)} className="ml-auto p-1 hover:bg-black/5 rounded">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Step */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {STEP_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.type}
                            onClick={() => addStep(opt.type)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all hover:shadow-sm ${opt.color}`}
                          >
                            <Icon size={13} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-surface-200 flex justify-end gap-3">
                <button onClick={() => setBuilding(false)} className="px-4 py-2 text-sm text-ink-400 hover:bg-surface-100 rounded-xl">
                  Cancel
                </button>
                <button className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-xl hover:bg-brand-600 transition-colors shadow-brand">
                  Save Workflow
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
