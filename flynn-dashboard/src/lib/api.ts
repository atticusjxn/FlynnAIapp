import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE as string || '').replace(/\/$/, '');

// ---------- Manifest types (mirror services/dashboard/manifestGenerator.js) ----------
export interface WidgetAction { label: string; action: string; args?: Record<string, unknown>; }
export interface Module {
  id: string;
  type: string;
  title: string;
  proactive: string;
  binding: { source: string; filter?: Record<string, unknown>; subject_handle?: string | null };
  actions: WidgetAction[];
  rank_score: number;
}
export interface Hero {
  type: string;
  title: string;
  body: string;
  cta?: WidgetAction;
  binding?: Record<string, unknown>;
}
export interface Manifest {
  schema_version: number;
  business_label: string | null;
  currency: string;
  generated_at: string;
  hero: Hero;
  modules: Module[];
}

export interface ManifestResponse {
  manifest: Manifest | null;
  version?: number | null;
  generated_at?: string | null;
  ready: boolean;
  reason?: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()), ...(init?.headers || {}) };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const getManifest = () => req<ManifestResponse>('/api/dashboard/manifest');
export const regenerate = () => req<{ manifest: Manifest; version: number }>('/api/dashboard/regenerate', { method: 'POST' });
export const getWidgetData = <T = any>(type: string) =>
  req<{ type: string; data: T }>(`/api/dashboard/widget-data?type=${encodeURIComponent(type)}`);

export interface ActionResult {
  ok?: boolean;
  result?: string;
  needsConnection?: boolean;
  provider?: string;
  connectLink?: string | null;
  needsConfirm?: boolean;
  needsInput?: boolean;
  message?: string;
  error?: string;
}
export const runAction = (toolName: string, args: Record<string, unknown>, confirmed = false) =>
  req<ActionResult>('/api/dashboard/action', {
    method: 'POST',
    body: JSON.stringify({ tool_name: toolName, args, confirmed }),
  });
