/**
 * Lightweight middleware using `jose` to verify NextAuth v5 JWT cookies directly.
 * Does NOT import next-auth, bcryptjs, or prisma — keeps the Edge bundle tiny.
 *
 * NextAuth v5 stores the session JWT in:
 *   - "authjs.session-token"        (development / HTTP)
 *   - "__Secure-authjs.session-token" (production / HTTPS)
 */
import { jwtVerify, createRemoteJWKSet } from "jose";
import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET!;

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

async function getToken(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  try {
    const secret = new TextEncoder().encode(AUTH_SECRET);
    await jwtVerify(cookie, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const isAuthenticated = await getToken(req);

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
    "/api/discovery",
    "/api/group-alignment",
  ],
};
