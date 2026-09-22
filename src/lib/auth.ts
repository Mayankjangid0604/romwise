import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { ROLES } from "./roles";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "email-password",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    Credentials({
      id: "phone-otp",
      name: "Phone",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        otpId: { label: "OTP ID", type: "text" },
      },
      async authorize(credentials) {
        const phone = credentials?.phone as string | undefined;
        const otpId = credentials?.otpId as string | undefined;

        if (!phone || !otpId) return null;

        const otp = await prisma.otpCode.findUnique({ where: { id: otpId } });
        if (!otp || otp.phone !== phone || !otp.verified) return null;
        if (otp.expiresAt && otp.expiresAt < new Date()) return null;

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(process.env.E2E_TEST_MODE === "true" ? [
      Credentials({
        id: "e2e-test",
        name: "E2E Test",
        credentials: {
          email: { label: "Email", type: "email" },
          secret: { label: "Secret", type: "password" },
        },
        async authorize(credentials) {
          if (credentials?.secret !== "E2E_TEST_SECRET") return null;
          const user = await prisma.user.findUnique({ where: { email: credentials.email as string } });
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        },
      })
    ] : []),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
