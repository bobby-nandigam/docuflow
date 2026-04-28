/**
 * DocuFlow API Client
 * Typed wrapper around all backend microservices
 */

import axios, { AxiosInstance } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── AUTH STORE (simple) ──────────────────────────────────────

let _accessToken: string | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("docuflow_token", token);
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("docuflow_token");
  }
  return null;
}

export function clearTokens() {
  _accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("docuflow_token");
    localStorage.removeItem("docuflow_refresh_token");
  }
}

// ─── AXIOS INSTANCE ───────────────────────────────────────────

const api: AxiosInstance = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = typeof window !== "undefined"
        ? localStorage.getItem("docuflow_refresh_token")
        : null;
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          setAccessToken(res.data.access_token);
          err.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api.request(err.config);
        } catch {
          clearTokens();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

// ─── TYPES ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer" | "guest";
  tenant: Tenant;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "pro" | "enterprise";
}

export interface Document {
  id: string;
  name: string;
  mime_type: string;
  extension: string;
  storage_size: number;
  status: "active" | "processing" | "archived" | "trashed";
  ai_summary?: string;
  ai_category?: string;
  ai_tags: string[];
  ai_sentiment?: string;
  ai_processed_at?: string;
  version: number;
  space_id?: string;
  parent_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  metadata?: Record<string, string>;
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  type: "personal" | "team" | "public";
  doc_count: number;
  my_role: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    document_id: string;
    filename: string;
    score: number;
    excerpt: string;
  }>;
  created_at: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: Record<string, any>;
  steps: any[];
  is_active: boolean;
  run_count: number;
  created_at: string;
}

// ─── AUTH API ─────────────────────────────────────────────────

export const authApi = {
  async register(data: { email: string; password: string; name: string; tenant_slug: string }) {
    const res = await api.post("/auth/register", data);
    setAccessToken(res.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("docuflow_refresh_token", res.data.refresh_token);
    }
    return res.data as { access_token: string; user: User; tenant: Tenant };
  },

  async login(data: { email: string; password: string; tenant_slug: string }) {
    const res = await api.post("/auth/login", data);
    setAccessToken(res.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("docuflow_refresh_token", res.data.refresh_token);
    }
    return res.data as { access_token: string; user: User; tenant: Tenant };
  },

  async logout() {
    await api.post("/auth/logout");
    clearTokens();
  },

  async me(): Promise<User> {
    const res = await api.get("/auth/me");
    return res.data;
  },
};

// ─── DOCUMENTS API ────────────────────────────────────────────

export const documentsApi = {
  async upload(file: File, options: { space_id?: string; parent_id?: string } = {}) {
    const form = new FormData();
    form.append("file", file);
    if (options.space_id) form.append("space_id", options.space_id);
    if (options.parent_id) form.append("parent_id", options.parent_id);
    const res = await api.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async list(params: {
    space_id?: string;
    parent_id?: string;
    search?: string;
    tags?: string;
    category?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    order?: "asc" | "desc";
  } = {}) {
    const res = await api.get("/documents", { params });
    return res.data as { documents: Document[]; total: number; page: number; pages: number };
  },

  async get(id: string): Promise<Document> {
    const res = await api.get(`/documents/${id}`);
    return res.data;
  },

  async download(id: string, filename: string) {
    const res = await api.get(`/documents/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  async delete(id: string) {
    await api.delete(`/documents/${id}`);
  },

  async listSpaces(): Promise<Space[]> {
    const res = await api.get("/spaces");
    return res.data;
  },

  async createSpace(data: { name: string; description?: string; icon?: string }) {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => v && form.append(k, v));
    const res = await api.post("/spaces", form);
    return res.data;
  },
};

// ─── AI API ───────────────────────────────────────────────────

export const aiApi = {
  async chat(data: {
    message: string;
    conversation_id?: string | null;
    document_ids?: string[];
    space_id?: string;
  }) {
    const res = await api.post("/ai/chat", data);
    return res.data as {
      conversation_id: string;
      answer: string;
      sources: Array<{ document_id: string; filename: string; score: number; excerpt: string }>;
    };
  },

  async semanticSearch(query: string, limit = 20) {
    const res = await api.post("/ai/search", { query, limit });
    return res.data.results;
  },

  async getRecommendations(docId: string) {
    const res = await api.get(`/ai/recommendations/${docId}`);
    return res.data.recommendations;
  },

  async getKnowledgeGraph(docId: string, depth = 2) {
    const res = await api.get(`/ai/knowledge-graph/${docId}`, { params: { depth } });
    return res.data as { nodes: any[]; edges: any[] };
  },
};

// ─── WORKFLOWS API ────────────────────────────────────────────

export const workflowsApi = {
  async list(): Promise<Workflow[]> {
    const res = await api.get("/workflows");
    return res.data;
  },

  async create(data: { name: string; trigger: any; steps: any[] }) {
    const res = await api.post("/workflows", data);
    return res.data;
  },

  async trigger(id: string, data: Record<string, any> = {}) {
    const res = await api.post(`/workflows/${id}/trigger`, data);
    return res.data;
  },

  async getRuns(id: string) {
    const res = await api.get(`/workflows/${id}/runs`);
    return res.data;
  },

  async getStepTypes() {
    const res = await api.get("/step-types");
    return res.data;
  },
};

// ─── INTEGRATIONS API ─────────────────────────────────────────

export const integrationsApi = {
  async list() {
    const res = await api.get("/integrations");
    return res.data;
  },

  async create(data: { type: string; name: string; credentials: any; settings?: any }) {
    const res = await api.post("/integrations", data);
    return res.data;
  },

  async sync(id: string) {
    const res = await api.post(`/integrations/${id}/sync`);
    return res.data;
  },

  async getAvailable() {
    const res = await api.get("/integrations/available");
    return res.data.integrations;
  },
};

// ─── WEBSOCKET CLIENT ─────────────────────────────────────────

export class DocuFlowWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectTimer: any = null;

  connect(token: string) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8060";
    this.ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const listeners = this.listeners.get(msg.type) || new Set();
      const allListeners = this.listeners.get("*") || new Set();
      [...listeners, ...allListeners].forEach(fn => fn(msg));
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected, reconnecting in 3s...");
      this.reconnectTimer = setTimeout(() => this.connect(token), 3000);
    };
  }

  on(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => this.listeners.get(eventType)?.delete(callback);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  ping() {
    this.ws?.send(JSON.stringify({ type: "ping" }));
  }
}

export const wsClient = new DocuFlowWebSocket();
