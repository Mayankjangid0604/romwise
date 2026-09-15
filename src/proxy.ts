/**
 * Zero-dependency Edge proxy (replaces deprecated middleware.ts).
 *
 * Uses the Web Crypto API (built into the Edge runtime — zero bundle cost)
 * to decrypt and validate the NextAuth v5 session token (JWE).
 *
 * NextAuth v5 encrypts session tokens using:
 *   - Algorithm  : dir (direct key agreement)
 *   - Encryption : A256CBC-HS512
 *   - Key source : HKDF-SHA256 from AUTH_SECRET
 *
 * A256CBC-HS512 uses a 64-byte Content Encryption Key (CEK) split as:
 *   - First  32 bytes → HMAC-SHA-512 MAC key
 *   - Second 32 bytes → AES-CBC-256 encryption key
 * The authentication tag is the first T_LEN=32 bytes of HMAC-SHA-512
 * over (AAD || IV || ciphertext || AL) where AL = AAD length in bits as
 * a big-endian 64-bit unsigned integer.
 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME_SECURE = "__Secure-authjs.session-token";
const COOKIE_NAME_PLAIN = "authjs.session-token";

// ─── HKDF — derive 64-byte CEK matching @auth/core getDerivedEncryptionKey ────
// Auth.js v5 passes the cookie name as `salt` and builds info as:
//   `Auth.js Generated Encryption Key (${salt})`
// The HKDF salt is the UTF-8 encoding of the cookie name (not empty).

async function deriveCek(secret: string, cookieName: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const info = `Auth.js Generated Encryption Key (${cookieName})`;
  const saltBytes = enc.encode(cookieName);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: enc.encode(info),
    },
    keyMaterial,
    512, // 64 bytes — full A256CBC-HS512 CEK
  );
  return new Uint8Array(bits);
}

// ─── Base64url decoder ────────────────────────────────────────────────────────

function b64uDecode(str: string): Uint8Array {
  const padded =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ─── AL encoding — AAD bit-length as big-endian uint64 ───────────────────────

function encodeAl(aadByteLength: number): Uint8Array {
  const al = new Uint8Array(8);
  let bits = aadByteLength * 8;
  for (let i = 7; i >= 0; i--) {
    al[i] = bits & 0xff;
    bits = Math.floor(bits / 256);
  }
  return al;
}

// ─── A256CBC-HS512 authenticated decryption (RFC 7518 §5.2.2.1) ──────────────

async function decryptA256CbcHs512(
  cek: Uint8Array,      // 64 bytes
  iv: Uint8Array,
  ciphertext: Uint8Array,
  authTag: Uint8Array,  // 32 bytes (T_LEN = MAC_KEY_LEN)
  aad: Uint8Array,      // ASCII-encoded JWE protected header
): Promise<Uint8Array | null> {
  const macKey = cek.slice(0, 32);
  const encKey = cek.slice(32, 64);

  // 1. Verify authentication tag
  const al = encodeAl(aad.length);
  const macInput = new Uint8Array(
    aad.length + iv.length + ciphertext.length + al.length,
  );
  let offset = 0;
  macInput.set(aad, offset);       offset += aad.length;
  macInput.set(iv, offset);        offset += iv.length;
  macInput.set(ciphertext, offset); offset += ciphertext.length;
  macInput.set(al, offset);

  const hmacKeyObj = await crypto.subtle.importKey(
    "raw",
    macKey,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", hmacKeyObj, macInput);
  const expectedTag = new Uint8Array(mac).slice(0, 32); // T = first T_LEN bytes

  // Constant-time comparison
  if (authTag.length !== expectedTag.length) return null;
  let diff = 0;
  for (let i = 0; i < authTag.length; i++) diff |= authTag[i] ^ expectedTag[i];
  if (diff !== 0) return null;

  // 2. Decrypt with AES-CBC-256
  const aesKey = await crypto.subtle.importKey(
    "raw",
    encKey,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
      aesKey,
      ciphertext.buffer as ArrayBuffer,
    );
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

// ─── Token validation ─────────────────────────────────────────────────────────

async function isValidToken(token: string, cookieName: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return false;

  // Compact JWE: header.encKey.iv.ciphertext.tag (5 base64url parts)
  const parts = token.split(".");
  if (parts.length !== 5) return false;

  try {
    const cek = await deriveCek(secret, cookieName);

    // For "dir" key agreement the encKey part (parts[1]) is empty string — skip it.
    // AAD is the ASCII bytes of the encoded header (parts[0]).
    const aad = new TextEncoder().encode(parts[0]);
    const iv = b64uDecode(parts[2]);
    const ciphertext = b64uDecode(parts[3]);
    const authTag = b64uDecode(parts[4]);

    const plaintext = await decryptA256CbcHs512(cek, iv, ciphertext, authTag, aad);
    if (!plaintext) return false;

    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Proxy (replaces middleware) ──────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  // Try secure cookie first (HTTPS), fall back to plain (HTTP dev)
  const secureToken = req.cookies.get(COOKIE_NAME_SECURE)?.value;
  const plainToken = req.cookies.get(COOKIE_NAME_PLAIN)?.value;

  const isValid =
    (secureToken && await isValidToken(secureToken, COOKIE_NAME_SECURE)) ||
    (plainToken && await isValidToken(plainToken, COOKIE_NAME_PLAIN));

  if (!isValid) {
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
