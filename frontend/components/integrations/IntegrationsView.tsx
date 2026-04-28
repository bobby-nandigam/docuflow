"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Plus, RefreshCw, Settings, AlertCircle, ExternalLink } from "lucide-react";

const AVAILABLE_INTEGRATIONS = [
  {
    id: "google_drive", name: "Google Drive", category: "Storage",
    description: "Sync files from Google Drive in real-time",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
    connected: true, status: "syncing", lastSync: "2 min ago", filesSync: 2341,
    features: ["Two-way sync", "Real-time webhooks", "Folder selection"],
  },
  {
    id: "slack", name: "Slack", category: "Communication",
    description: "Send document notifications to Slack channels",
    icon: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    connected: true, status: "active", lastSync: "Active", filesSync: null,
    features: ["Notifications", "Slash commands", "Document previews"],
  },
  {
    id: "dropbox", name: "Dropbox", category: "Storage",
    description: "Import and sync documents from Dropbox",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg",
    connected: false, status: null, lastSync: null, filesSync: null,
    features: ["Folder sync", "Incremental updates"],
  },
  {
    id: "salesforce", name: "Salesforce", category: "CRM",
    description: "Attach documents to CRM records automatically",
    icon: "☁️",
    connected: false, status: null, lastSync: null, filesSync: null,
    features: ["Attach to records", "Opportunity docs", "Contact files"],
  },
  {
    id: "sharepoint", name: "SharePoint", category: "Storage",
    description: "Migrate or sync from SharePoint libraries",
    icon: "📋",
    connected: false, status: null, lastSync: null, filesSync: null,
    features: ["Library sync", "Permission mapping", "Metadata preservation"],
  },
  {
    id: "email", name: "Email (IMAP)", category: "Communication",
    description: "Automatically capture email attachments",
    icon: "📧",
    connected: false, status: null, lastSync: null, filesSync: null,
    features: ["Attachment capture", "Auto-filing", "Smart routing"],
  },
];

export function IntegrationsView() {
  const [integrations, setIntegrations] = useState(AVAILABLE_INTEGRATIONS);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const simulateConnect = async (id: string) => {
    setConnectingId(id);
    await new Promise(r => setTimeout(r, 1500));
    setIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, connected: true, status: "active", lastSync: "Just now" } : i
    ));
    setConnectingId(null);
  };

  const categories = [...new Set(integrations.map(i => i.category))];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-ink-500">Integrations</h1>
          <p className="text-sm text-ink-100 mt-1">
            Connect your tools. {integrations.filter(i => i.connected).length} of {integrations.length} connected.
          </p>
        </div>
      </div>

      {/* Connected integrations summary */}
      <div className="grid grid-cols-3 gap-4">
        {integrations.filter(i => i.connected).map(integration => (
          <div key={integration.id} className="bg-white border border-surface-200 rounded-2xl p-4 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {integration.icon.startsWith("http") ? (
                  <img src={integration.icon} alt={integration.name} className="w-7 h-7 object-contain" />
                ) : (
                  <span className="text-2xl">{integration.icon}</span>
                )}
                <div>
                  <p className="text-sm font-semibold text-ink-500">{integration.name}</p>
                  <p className="text-xs text-ink-50">{integration.category}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {integration.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-50">
              <span>{integration.filesSync ? `${integration.filesSync.toLocaleString()} files` : "Active"}</span>
              <span>{integration.lastSync}</span>
            </div>
          </div>
        ))}
      </div>

      {/* All integrations by category */}
      {categories.map(category => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-ink-100 uppercase tracking-wider mb-3">{category}</h2>
          <div className="grid grid-cols-2 gap-4">
            {integrations.filter(i => i.category === category).map((integration, idx) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border border-surface-200 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-surface-50 rounded-xl border border-surface-200 flex items-center justify-center flex-shrink-0">
                    {integration.icon.startsWith("http") ? (
                      <img src={integration.icon} alt={integration.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <span className="text-2xl">{integration.icon}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink-500">{integration.name}</h3>
                      {integration.connected && (
                        <CheckCircle size={14} className="text-emerald-500" />
                      )}
                    </div>
                    <p className="text-sm text-ink-100 mb-3">{integration.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {integration.features.map(f => (
                        <span key={f} className="text-xs bg-surface-100 text-ink-100 px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {integration.connected ? (
                        <>
                          <button className="flex items-center gap-1.5 text-xs text-ink-100 hover:text-ink-400 transition-colors">
                            <RefreshCw size={12} />Sync now
                          </button>
                          <button className="flex items-center gap-1.5 text-xs text-ink-100 hover:text-ink-400 transition-colors ml-2">
                            <Settings size={12} />Configure
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => simulateConnect(integration.id)}
                          disabled={connectingId === integration.id}
                          className="flex items-center gap-2 bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-brand-600 transition-all disabled:opacity-60 shadow-brand"
                        >
                          {connectingId === integration.id ? (
                            <><RefreshCw size={12} className="animate-spin" />Connecting...</>
                          ) : (
                            <><Plus size={12} />Connect</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
