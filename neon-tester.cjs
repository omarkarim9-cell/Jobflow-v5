// neon-tester.cjs
require('dotenv').config();
const express = require('express');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const { Pool } = require('pg');
const { verifyToken } = require("@clerk/clerk-sdk-node");

const app = express();
// dev-only: allow requests from your frontend and avoid 404 on /
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.get('/', (_req, res) => res.send('Neon tester running'));

// simple root route so GET / doesn't 404
app.get('/', (_req, res) => res.send('Neon tester running'));

app.use(express.json());
async function getClerkUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie || "";

  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  } else {
    const payload = decodeSessionCookie(cookieHeader);
    if (payload && payload.sid) {
      // fallback: still support old cookie-based flow
      const session = await clerkClient.sessions.getSession(payload.sid);
      if (!session || session.status !== "active") {
        throw new Error("Session not active");
      }
      return { session, userId: session.userId };
    }
  }

  if (!token) {
    throw new Error("No token provided");
  }

  const verified = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  const sessionId = verified.sessionId;
  if (!sessionId) {
    throw new Error("Invalid token");
  }

  const session = await clerkClient.sessions.getSession(sessionId);
  if (!session || session.status !== "active") {
    throw new Error("Session not active");
  }

  return { session, userId: session.userId };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function decodeSessionCookie(cookieHeader) {
  try {
    if (!cookieHeader) return null;
    const m = cookieHeader.match(/(?:^|; )__session=([^;]+)/);
    if (!m) return null;
    const jwt = decodeURIComponent(m[1]);
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload;
  } catch (err) {
    console.error('[TESTER] decodeSessionCookie error', err);
    return null;
  }
}

app.get('/api/test/health', (_req, res) => {
  res.json({ ok: true, env: !!process.env.CLERK_SECRET_KEY && !!process.env.DATABASE_URL });
});

app.post('/api/test/profile', async (req, res) => {
  try {
    const cookieHeader = req.headers.cookie || '';
    const payload = decodeSessionCookie(cookieHeader);
    if (!payload || !payload.sid) return res.status(401).json({ ok: false, error: 'No session cookie' });

    const sid = payload.sid;
    let session;
    try {
      session = await clerkClient.sessions.getSession(sid);
    } catch (err) {
      console.error('[TESTER] clerk.sessions.getSession error', err);
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

    if (!session || session.status !== 'active') {
      return res.status(401).json({ ok: false, error: 'Session not active' });
    }

    const clerkUserId = session.userId;
    let clerkUser = null;
    try {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch (err) {
      console.warn('[TESTER] could not fetch user from Clerk', err);
    }

    const email = (req.body && req.body.email) || (clerkUser && clerkUser.primaryEmailAddress && clerkUser.primaryEmailAddress.emailAddress) || null;
    const full_name = (req.body && req.body.full_name) || (clerkUser && (clerkUser.fullName || clerkUser.firstName)) || null;
    const resume_content = (req.body && req.body.resume_content) || null;
    const preferences = (req.body && req.body.preferences) ? JSON.stringify(req.body.preferences) : null;
    const connected_accounts = (req.body && req.body.connected_accounts) ? JSON.stringify(req.body.connected_accounts) : null;
    const plan = (req.body && req.body.plan) || null;
    const phone = (req.body && req.body.phone) || null;
    const resume_file_name = (req.body && req.body.resume_file_name) || null;

    const client = await pool.connect();
    try {
      const upsertQuery = `
        INSERT INTO profiles (
          id, email, full_name, resume_content, preferences, connected_accounts,
          plan, daily_ai_credits, total_ai_used, updated_at, phone, resume_file_name, clerk_user_id
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3,
          COALESCE($4::jsonb, '{"language":"en","notifications": true}'::jsonb),
          COALESCE($5::jsonb, '{}'::jsonb),
          COALESCE($6, 'free'), 5, 0, NOW(), COALESCE($7, ''), COALESCE($8, ''), $9
        )
        ON CONFLICT (clerk_user_id) DO UPDATE
          SET email = EXCLUDED.email,
              full_name = EXCLUDED.full_name,
              resume_content = EXCLUDED.resume_content,
              preferences = EXCLUDED.preferences,
              connected_accounts = EXCLUDED.connected_accounts,
              plan = EXCLUDED.plan,
              updated_at = NOW(),
              phone = EXCLUDED.phone,
              resume_file_name = EXCLUDED.resume_file_name
        RETURNING id, email, full_name, clerk_user_id;
      `;
      const result = await client.query(upsertQuery, [
        email,
        full_name,
        resume_content,
        preferences,
        connected_accounts,
        plan,
        phone,
        resume_file_name,
        clerkUserId,
      ]);
      const row = result.rows[0];
      console.log('[TESTER] upserted profile', row);
      return res.status(200).json({ ok: true, profile: row });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[TESTER] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/api/test/jobs', async (req, res) => {
  try {
    const cookieHeader = req.headers.cookie || '';
    const payload = decodeSessionCookie(cookieHeader);
    if (!payload || !payload.sid) return res.status(401).json({ ok: false, error: 'No session cookie' });

    const sid = payload.sid;
    let session;
    try {
      session = await clerkClient.sessions.getSession(sid);
    } catch (err) {
      console.error('[TESTER] clerk.sessions.getSession error', err);
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

    if (!session || session.status !== 'active') {
      return res.status(401).json({ ok: false, error: 'Session not active' });
    }

    const clerkUserId = session.userId;
    const client = await pool.connect();
    try {
      const findProfile = await client.query('SELECT id FROM profiles WHERE clerk_user_id = $1 LIMIT 1', [clerkUserId]);
      if (findProfile.rowCount === 0) {
        return res.status(400).json({ ok: false, error: 'Profile not found for this user. Create profile first.' });
      }
      const user_id = findProfile.rows[0].id;

      const {
        title = null,
        company = null,
        description = null,
        status = 'saved',
        source = null,
        application_url = null,
        custom_resume = null,
        cover_letter = null,
        match_score = null,
        data = null,
      } = req.body || {};

      const insertQuery = `
        INSERT INTO jobs (
          id, user_id, title, company, description, status, source, application_url,
          custom_resume, cover_letter, match_score, data, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::jsonb, '{}'::jsonb), NOW(), NOW()
        )
        RETURNING id, user_id, title, company, status;
      `;
      const result = await client.query(insertQuery, [
        user_id,
        title,
        company,
        description,
        status,
        source,
        application_url,
        custom_resume,
        cover_letter,
        match_score,
        data ? JSON.stringify(data) : null,
      ]);
      const jobRow = result.rows[0];
      console.log('[TESTER] created job', jobRow);
      return res.status(201).json({ ok: true, job: jobRow });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[TESTER] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
app.listen(port, () => {
  console.log(`Neon tester listening on http://localhost:${port}`);
});
