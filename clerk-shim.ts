import { createRemoteJWKSet, jwtVerify } from "jose";

const CLERK_ISSUER = "https://clerk.kush-edu.com";
const JWKS_URL = `${CLERK_ISSUER}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: CLERK_ISSUER });
    return payload as Record<string, any>;
  } catch (err) {
    console.error("[JWT VERIFY] Error:", err);
    return null;
  }
}

export async function verifyJwtAndGetSub(token: string): Promise<string | null> {
  const payload = await verifyJwt(token);
  return payload && typeof payload.sub === "string" ? payload.sub : null;
}

export async function verifyToken(token: string, _opts?: any) {
  const payload = await verifyJwt(token);
  if (!payload) throw new Error("Invalid token");
  return { payload };
}

/**
 * Build a minimal session-like object that matches common Clerk usage in this repo.
 * It includes: sessionId, userId, getUserId(), payload, and toAuth() returning auth info.
 */
function buildSessionFromPayload(payload: Record<string, any>) {
  const sessionId = payload.jti ?? null;
  const userId = payload.sub ?? null;

  const session = {
    sessionId,
    userId,
    getUserId: () => userId,
    payload,
    /**
     * toAuth returns a minimal auth object. Add fields here if your code expects them.
     */
    toAuth: () => ({
      userId,
      sessionId,
      getUserId: () => userId,
      // token-like fields if needed by your code:
      // token: payload.__raw ?? null,
      // roles: payload.roles ?? [],
    }),
  };

  return session;
}

/**
 * Minimal createClerkClient shim
 */
export function createClerkClient(_opts?: any) {
  return {
    verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    sessions: {
      verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    },
    authenticateRequest: async (req: any) => {
      const authHeader =
        req?.headers?.authorization ??
        req?.headers?.Authorization ??
        (typeof req?.get === "function" ? req.get("authorization") : undefined);

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Unauthorized - Missing token");
      }
      const token = authHeader.split(" ")[1];
      const payload = await verifyJwt(token);
      if (!payload) throw new Error("Unauthorized - Invalid token");

      return buildSessionFromPayload(payload);
    },
  };
}

export default verifyToken;
