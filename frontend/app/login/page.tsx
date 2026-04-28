"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await authApi.login({ email, password, tenant_slug: tenantSlug });
      } else {
        await authApi.register({ email, password, name, tenant_slug: tenantSlug });
      }
      window.location.href = "/";
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-surface-900 border border-surface-800 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center shadow-brand">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-xl">DocuFlow</span>
              <span className="ml-2 text-xs font-medium bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full">AI</span>
            </div>
          </div>

          <h1 className="text-2xl font-display font-bold text-white mb-1">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-surface-300 text-sm mb-6">
            {mode === "login"
              ? "Sign in to your workspace"
              : "Start your AI-powered document workspace"}
          </p>

          {/* Toggle */}
          <div className="flex bg-surface-800 rounded-xl p-1 mb-6">
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  mode === m ? "bg-white text-ink-500 shadow-sm" : "text-surface-300 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <Field label="Full Name" type="text" value={name} onChange={setName} placeholder="Jane Doe" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
            <div className="relative">
              <Field
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-surface-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Field
              label={mode === "login" ? "Workspace" : "Create Workspace"}
              type="text"
              value={tenantSlug}
              onChange={setTenantSlug}
              placeholder="my-company"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-medium transition-all shadow-brand hover:shadow-glow disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-4 p-3 bg-surface-800 rounded-xl">
            <p className="text-xs text-surface-400 text-center">
              Demo: <span className="text-brand-400">admin@acme.com</span> / <span className="text-brand-400">demo123</span> / workspace: <span className="text-brand-400">acme-corp</span>
            </p>
          </div>
        </div>

        {/* Social proof */}
        <p className="text-center text-surface-500 text-xs mt-4">
          Trusted by 500+ enterprises · SOC 2 Type II Certified
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-surface-300 block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
      />
    </div>
  );
}
