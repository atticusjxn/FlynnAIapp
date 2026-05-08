/**
 * Trigger GitHub Actions workflows from the dashboard.
 * Uses a fine-grained Personal Access Token stored in localStorage.
 */

const REPO = 'atticusjxn/FlynnAIapp';
const STORAGE_KEY = 'flynn_gtm_github_pat';

export function getGitHubPAT(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setGitHubPAT(pat: string): void {
  localStorage.setItem(STORAGE_KEY, pat.trim());
}

export function clearGitHubPAT(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  message: string;
  runUrl: string;
}

/**
 * Triggers a workflow_dispatch and returns a link to the running Action.
 * GitHub doesn't return the run ID directly from the dispatch endpoint,
 * so we follow up with a list-runs query to find the just-created run.
 */
export async function triggerWorkflow(
  workflowFile: string,
  inputs: Record<string, string | boolean> = {},
): Promise<DispatchResult> {
  const pat = getGitHubPAT();
  if (!pat) {
    return {
      ok: false,
      status: 0,
      message: 'No GitHub token configured. Click ⚙️ Settings to add one.',
      runUrl: `https://github.com/${REPO}/actions/workflows/${workflowFile}`,
    };
  }

  // Cast booleans to strings — GitHub's workflow_dispatch inputs are stringly-typed
  const stringInputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs)) {
    stringInputs[k] = typeof v === 'boolean' ? String(v) : v;
  }

  const dispatchUrl = `https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/dispatches`;
  const dispatchRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main', inputs: stringInputs }),
  });

  if (!dispatchRes.ok) {
    let msg = `GitHub API ${dispatchRes.status}`;
    try {
      const body = (await dispatchRes.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      // ignore parse errors
    }
    return {
      ok: false,
      status: dispatchRes.status,
      message: msg,
      runUrl: `https://github.com/${REPO}/actions/workflows/${workflowFile}`,
    };
  }

  // Poll up to 8 times (≈12s) for the *new* run that's strictly newer than now.
  // GitHub's workflow_dispatch returns 204 immediately but takes a few seconds
  // to actually create the workflow run. Without polling, we'd surface the
  // most recent OLD run as the "view run" link.
  const dispatchedAt = Date.now();
  const runsUrl = `https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/runs?per_page=3`;
  let runUrl = `https://github.com/${REPO}/actions/workflows/${workflowFile}`;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const runsRes = await fetch(runsUrl, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}` },
      });
      if (!runsRes.ok) continue;
      const data = (await runsRes.json()) as {
        workflow_runs?: Array<{ html_url: string; created_at: string }>;
      };
      const fresh = (data.workflow_runs ?? []).find(
        (r) => new Date(r.created_at).getTime() >= dispatchedAt - 2000,
      );
      if (fresh) {
        runUrl = fresh.html_url;
        break;
      }
    } catch {
      // best-effort; keep retrying
    }
  }

  return {
    ok: true,
    status: dispatchRes.status,
    message: 'Workflow triggered',
    runUrl,
  };
}

/**
 * Returns the most-recent run for each of the GTM workflows.
 * Used by the dashboard to show "last run X minutes ago, status Y".
 */
export interface WorkflowStatus {
  workflowFile: string;
  state: 'queued' | 'in_progress' | 'completed' | 'unknown';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  startedAt: string | null;
  htmlUrl: string;
}

export async function fetchLastRun(workflowFile: string): Promise<WorkflowStatus | null> {
  const pat = getGitHubPAT();
  if (!pat) return null;
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/runs?per_page=1`,
    {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${pat}` },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { workflow_runs?: any[] };
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    workflowFile,
    state: run.status as WorkflowStatus['state'],
    conclusion: run.conclusion as WorkflowStatus['conclusion'],
    startedAt: run.run_started_at as string,
    htmlUrl: run.html_url as string,
  };
}
