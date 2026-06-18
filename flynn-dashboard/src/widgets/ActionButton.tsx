import React, { useState } from 'react';
import { runAction, type WidgetAction } from '../lib/api';

/**
 * Renders a CTA from a manifest action string and drives web-initiated tool
 * execution: namespaced `tool:` actions POST to the backend and handle the
 * needsConnection / needsConfirm responses; `nav:` and `link:` just navigate.
 */
export default function ActionButton({ action, variant = 'outline' }: { action: WidgetAction; variant?: 'primary' | 'outline' }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const cls = variant === 'primary' ? 'btn-primary' : 'btn-outline';

  function navigate() {
    const [kind, ...rest] = action.action.split(':');
    const target = rest.join(':');
    if (kind === 'nav') window.location.assign(`/dashboard#${target}`);
    else if (kind === 'link') window.open(target, '_blank', 'noopener');
  }

  async function exec(confirmed: boolean) {
    const toolName = action.action.replace(/^tool:/, '');
    setBusy(true);
    setStatus(null);
    try {
      const r = await runAction(toolName, action.args || {}, confirmed);
      if (r.needsConfirm && r.message) { setConfirm(r.message); return; }
      if (r.needsConnection) { setStatus(r.connectLink ? 'check your texts for a connect link' : `connect ${r.provider} first`); return; }
      if (r.needsInput && r.message) { setStatus(r.message); return; }
      if (r.error) { setStatus(r.error); return; }
      setStatus(r.result || 'done');
      setConfirm(null);
    } catch (e: any) {
      setStatus(e?.message || 'something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    if (action.action.startsWith('tool:')) exec(false);
    else navigate();
  }

  return (
    <div className="inline-flex flex-col gap-1">
      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-700">{confirm}</span>
          <button className="btn-primary" disabled={busy} onClick={() => exec(true)}>yes</button>
          <button className="btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>no</button>
        </div>
      ) : (
        <button className={cls} disabled={busy} onClick={onClick}>
          {busy ? '…' : action.label}
        </button>
      )}
      {status && <span className="text-xs text-neutral-500">{status}</span>}
    </div>
  );
}
