import { Webhook } from 'svix';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Get raw body as string
  let payload: string;
  if (typeof req.body === 'string') {
    payload = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    payload = req.body.toString('utf-8');
  } else {
    payload = JSON.stringify(req.body);
  }

  const headers = {
    'svix-id': req.headers['svix-id'] as string,
    'svix-timestamp': req.headers['svix-timestamp'] as string,
    'svix-signature': req.headers['svix-signature'] as string,
  };

  let event;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(payload, headers) as any;
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address || '';
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    try {
      const sql = neon(process.env.DATABASE_URL!);
      
      await sql`
        INSERT INTO user_profiles (
          id, full_name, email, phone, resume_content, resume_file_name,
          preferences, connected_accounts, plan, daily_ai_credits, total_ai_used,
          onboarded_at, updated_at
        ) VALUES (
          ${id}, ${fullName}, ${email}, '', '', '',
          '{"targetRoles":[],"targetLocations":[],"minSalary":"","remoteOnly":false,"language":"en"}',
          '[]', 'pro', 100, 0, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;

      console.log(`✅ User ${id} created in Neon`);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  return res.status(200).json({ received: true });
}