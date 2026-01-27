// File: pages/api/auto-apply.ts
// Copy → paste as-is. Replace the TODO helpers with your real auth/token helpers and adapt the email payload as needed.

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Helper: call Gmail with one refresh attempt
 */
async function callGmailWithOneRefresh(
  fetchFn: (token: string) => Promise<Response>,
  getAccessToken: () => Promise<string | null>,
  refreshTokenFn: () => Promise<{ access_token?: string } | null>
) {
  let token = await getAccessToken();
  if (!token) {
    const e: any = new Error('No access token');
    e.status = 401;
    throw e;
  }

  let res = await fetchFn(token);

  if (res.status === 401) {
    const refreshed = await refreshTokenFn();
    if (refreshed?.access_token) {
      token = refreshed.access_token;
      res = await fetchFn(token);
    }
  }

  if (res.status === 401) {
    const err: any = new Error('Gmail API 401');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Build a minimal raw RFC2822 message and return base64url string for Gmail API
 * Adjust subject/body/from/to as needed for your application.
 */
function buildRawMessage({ fromEmail, toEmail, subject, body }: { fromEmail: string; toEmail: string; subject: string; body: string; }) {
  const message =
    `From: ${fromEmail}\r\n` +
    `To: ${toEmail}\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `\r\n` +
    `${body}\r\n`;

  // base64url encode
  const b64 = Buffer.from(message).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * TODO: Replace these helpers with your real implementations
 */
async function getAccessToken(): Promise<string | null> {
  // Return current access token for the Gmail account used by auto-apply
  // e.g., read from session, DB, or server-side token store
  return null; // <-- REPLACE
}
async function refreshAccessToken(): Promise<{ access_token?: string } | null> {
  // Perform refresh token flow (server-side) and return new access_token if successful
  return null; // <-- REPLACE
}

/**
 * Example performApply: constructs a simple email and sends via Gmail API using the wrapper above.
 * Adapt to your real apply flow (attachments, HTML, different recipients, etc).
 */
async function performApply(job: any, userProfile: any) {
  // TODO: set these values appropriately
  const fromEmail = 'me'; // Gmail API accepts "me" for authenticated user
  const toEmail = job.applicationEmail || job.contactEmail || 'hr@example.com';
  const subject = `Application: ${job.title || job.company}`;
  const body = `Hello,\n\nPlease find my application for ${job.title || job.company}.\n\nRegards,\n${userProfile?.name || 'Applicant'}`;

  const raw = buildRawMessage({ fromEmail, toEmail, subject, body });

  const fetchFn = async (token: string) => {
    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
  };

  // callGmailWithOneRefresh will throw with status===401 on final auth failure
  return callGmailWithOneRefresh(fetchFn, getAccessToken, refreshAccessToken);
}

/**
 * Next.js API handler
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { job, userProfile } = req.body ?? {};

  if (!job || !userProfile) return res.status(400).json({ error: 'Missing job or userProfile' });

  try {
    await performApply(job, userProfile);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    const is401 = err?.status === 401 || (typeof err?.message === 'string' && err.message.includes('401'));
    if (is401) {
      // Surface 401 to client so AutomationModal can call onAuthError()
      return res.status(401).json({ error: 'Gmail authentication failed' });
    }
    const msg = err?.message || 'Auto-apply failed';
    return res.status(500).json({ error: msg });
  }
}
