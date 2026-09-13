"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type AuthState = {
  error?: string;
};

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates at 72 bytes

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await getClientIp();
  const { allowed, retryAfterSeconds } = checkRateLimit(`signup:${ip}`);
  if (!allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be ${MAX_NAME_LENGTH} characters or less` };
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return { error: "Email address is too long" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  resetRateLimit(`signup:${ip}`);

  await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  redirect("/dashboard");
}

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await getClientIp();
  const { allowed, retryAfterSeconds } = checkRateLimit(`login:${ip}`);
  if (!allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: "Invalid email or password" };
  }

  resetRateLimit(`login:${ip}`);

  redirect("/dashboard");
}
