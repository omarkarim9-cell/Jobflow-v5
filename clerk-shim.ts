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
 * Minimal createClerkClient shim
 */
export function createClerkClient(_opts?: any) {
  return {
    verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    sessions: {
      verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    },
    /**
     * authenticateRequest accepts a Node/Next request-like object and returns
     * a minimal session object similar to Clerk's authenticateRequest.
     * It looks for Authorization: Bearer <token> in headers.
     */
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

      // Return a minimal session-like object. Add fields if your code expects them.
      return {
        sessionId: payload.jti ?? null,
        userId: payload.sub ?? null,
        getUserId: () => payload.sub ?? null,
        payload,
      };
    },
  };
}

export default verifyToken;
