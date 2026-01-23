import { createRemoteJWKSet, jwtVerify } from "jose";

const CLERK_ISSUER = "https://clerk.kush-edu.com";
const JWKS_URL = `${CLERK_ISSUER}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export async function verifyJwtAndGetSub(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: CLERK_ISSUER });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch (err) {
    console.error("[JWT VERIFY] Error:", err);
    return null;
  }
}

export async function verifyToken(token: string, _opts?: any) {
  const sub = await verifyJwtAndGetSub(token);
  if (!sub) throw new Error("Invalid token");
  return { payload: { sub } as any };
}

export function createClerkClient(_opts?: any) {
  return {
    verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    sessions: {
      verifyToken: async (token: string, opts?: any) => verifyToken(token, opts),
    },
  };
}

export default verifyToken;
