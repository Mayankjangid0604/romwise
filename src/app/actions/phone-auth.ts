"use server";

import { prisma } from "@/lib/db";
import { createOtp, verifyOtp, validatePhone } from "@/lib/otp";
import { getSmsProvider } from "@/lib/sms";
import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export type PhoneAuthState = {
  step: "phone" | "otp";
  phone?: string;
  error?: string;
};

export async function requestOtp(
  _prevState: PhoneAuthState,
  formData: FormData,
): Promise<PhoneAuthState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateResult = checkRateLimit(`otp:${ip}`);
  if (!rateResult.allowed) {
    return { step: "phone", error: "Too many attempts. Try again later." };
  }

  const rawPhone = (formData.get("phone") as string)?.trim();
  if (!rawPhone) {
    return { step: "phone", error: "Phone number is required" };
  }

  const phoneResult = validatePhone(rawPhone);
  if (!phoneResult.valid) {
    return { step: "phone", error: phoneResult.error };
  }
  const phone = phoneResult.normalized!;

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  const code = await createOtp(phone, existingUser?.id);

  const sms = getSmsProvider();
  const sendResult = await sms.send(phone, `Your Roamwise code is ${code}. Valid for 10 minutes.`);
  if (!sendResult.success) {
    return { step: "phone", error: "Failed to send SMS. Try again." };
  }

  return { step: "otp", phone };
}

export async function verifyOtpAction(
  _prevState: PhoneAuthState,
  formData: FormData,
): Promise<PhoneAuthState> {
  const phone = formData.get("phone") as string;
  const code = (formData.get("code") as string)?.trim();

  if (!phone || !code) {
    return { step: "otp", phone, error: "Enter the verification code" };
  }

  if (!/^\d{6}$/.test(code)) {
    return { step: "otp", phone, error: "Code must be 6 digits" };
  }

  const result = await verifyOtp(phone, code);

  if (!result.valid) {
    const messages: Record<string, string> = {
      expired: "Code expired. Request a new one.",
      invalid: "Wrong code. Try again.",
      too_many_attempts: "Too many attempts. Request a new code.",
      not_found: "No pending code. Request a new one.",
    };
    return { step: "otp", phone, error: messages[result.reason] };
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        phoneVerified: true,
        name: "Traveler",
      },
    });
  } else if (!user.phoneVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });
  }

  await signIn("phone-otp", {
    redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    phone,
    otpId: result.otpId,
  });

  // Safety fallback — signIn above always redirects, but TypeScript requires a return
  return { step: "otp", phone };
}
