
/**
 * Service to interact with Gmail API using OAuth Access Token.
 * Note: This runs entirely in the browser.
 */

// Helper to strip 'Bearer ' and quotes if user pasted them
export const sanitizeToken = (token: string) => {
  if (!token) return '';
  
  let t = token.trim();

  // Handle if user pasted a JSON object (common mistake)
  if (t.startsWith('{') && t.endsWith('}')) {
      try {
          const parsed = JSON.parse(t);
          if (parsed.access_token) return parsed.access_token;
      } catch (e) {
          // Not valid JSON, continue with string processing
      }
  }

  // Remove "Bearer " prefix case-insensitive
  if (t.toLowerCase().startsWith('bearer ')) {
      t = t.slice(7).trim();
  }
  
  // Remove surrounding quotes (single, double, or smart quotes)
  t = t.replace(/^["'“”]+|["'“”]+$/g, '');

  return t;
};

// --- HELPER: Fetch with strict timeout ---
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const fetchGmailProfile = async (accessToken: string) => {
  const cleanToken = sanitizeToken(accessToken);

  const response = await fetchWithTimeout('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    }
  });

  // Surface 401 explicitly so callers can stop auto-apply and prompt reconnect
  if (response.status === 401) {
    const body = await response.text().catch(() => '');
    const err: any = new Error(`Gmail API 401: ${body}`);
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gmail profile error ${response.status}: ${body}`);
  }

  return response.json();
};


export const listMessages = async (accessToken: string, limit: number = 50, query: string = 'subject:(job OR jobs OR vacancy OR career OR hiring OR opportunity)') => {
  const cleanToken = sanitizeToken(accessToken);
  const encodedQuery = encodeURIComponent(query);

  const response = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodedQuery}&_t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  // Surface 401 explicitly so callers can stop auto-apply and prompt reconnect
  if (response.status === 401) {
    const body = await response.text().catch(() => '');
    const err: any = new Error(`Gmail API 401: ${body}`);
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gmail list messages error ${response.status}: ${body}`);
  }

  return response.json();
};


export const getMessageBody = async (accessToken: string, messageId: string) => {
  const cleanToken = sanitizeToken(accessToken);

  const response = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    },
    cache: 'force-cache',
  });

  // Surface 401 explicitly so callers can stop auto-apply and prompt reconnect
  if (response.status === 401) {
    const body = await response.text().catch(() => '');
    const err: any = new Error(`Gmail API 401: ${body}`);
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gmail get message error ${response.status}: ${body}`);
  }

  return response.json();
};

export const decodeEmailBody = (messageData: any): string => {
  let body = '';
  
  const getPart = (parts: any[]): any => {
    // Prefer text/html, fallback to text/plain
    let part = parts.find((p: any) => p.mimeType === 'text/html');
    if (!part) {
      part = parts.find((p: any) => p.mimeType === 'text/plain');
    }
    // Handle nested parts (multipart/alternative inside multipart/mixed)
    if (!part && parts.length > 0) {
       for (const p of parts) {
           if (p.parts) {
               const found = getPart(p.parts);
               if (found) return found;
           }
       }
    }
    return part;
  };

  if (messageData.payload) {
    if (messageData.payload.parts) {
      const part = getPart(messageData.payload.parts);
      if (part && part.body && part.body.data) {
        body = part.body.data;
      }
    } else if (messageData.payload.body && messageData.payload.body.data) {
      body = messageData.payload.body.data;
    }
  }

  // Decode Base64Url (RFC 4648)
  if (body) {
    try {
      const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
      // Decode base64 to string (handling UTF-8)
      const binaryString = atob(base64);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error('Failed to decode email body', e);
      return '';
    }
  }
  
  return '';
};