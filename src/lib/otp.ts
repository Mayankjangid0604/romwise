import { randomInt } from "crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "./db";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

// When OTP_TEST_BYPASS=true, any phone accepts the fixed code "000000".
// Never enable in production.
const TEST_BYPASS = process.env.OTP_TEST_BYPASS === "true";
const TEST_CODE = "000000";

export function generateOtpCode(): string {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  return String(randomInt(min, max));
}

export async function createOtp(phone: string, userId?: string): Promise<string> {
  await prisma.otpCode.updateMany({
    where: { phone, verified: false },
    data: { verified: true },
  });

  const code = generateOtpCode();
  const codeHash = await hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash,
      expiresAt,
      userId: userId ?? null,
    },
  });

  return code;
}

export type VerifyResult =
  | { valid: true; otpId: string }
  | { valid: false; reason: "expired" | "invalid" | "too_many_attempts" | "not_found" };

export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { valid: false, reason: "not_found" };

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: "too_many_attempts" };
  }

  if (otp.expiresAt < new Date()) {
    return { valid: false, reason: "expired" };
  }

  const isValid = (TEST_BYPASS && code === TEST_CODE) || (await compare(code, otp.codeHash));

  if (!isValid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { valid: false, reason: "invalid" };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return { valid: true, otpId: otp.id };
}

const PHONE_REGEX = /^\+91[6-9]\d{9}$/;

export function validatePhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  const cleaned = phone.replace(/[\s\-()]/g, "");

  if (cleaned.startsWith("+91") && PHONE_REGEX.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: `+91${cleaned}` };
  }

  return { valid: false, error: "Enter a valid Indian mobile number" };
}
