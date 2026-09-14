/**
 * Edge-compatible auth config.
 * No Node.js-only imports (no bcryptjs, no prisma).
 * Used exclusively by middleware for JWT session checking.
 */
import NextAuth from "next-auth";

export const { auth } = NextAuth({
  providers: [],           // Providers are not needed in middleware
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
