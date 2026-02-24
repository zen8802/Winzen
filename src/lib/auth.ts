import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { applyStreakLogin } from "./daily-streak";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { label: "Email" }, password: { label: "Password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !(await compare(credentials.password, user.password))) return null;

        const streakResult = await applyStreakLogin(user.id, prisma);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          streakReward: streakResult.reward,
          loginStreak: streakResult.newStreak,
          role: user.role, // "user" | "admin"
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.streakReward = (user as { streakReward?: number }).streakReward ?? 0;
        token.loginStreak = (user as { loginStreak?: number }).loginStreak ?? 0;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.streakReward = (token.streakReward as number) ?? 0;
        session.user.loginStreak = (token.loginStreak as number) ?? 0;
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      streakReward: number;
      loginStreak: number;
      role: string; // "user" | "admin"
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    streakReward?: number;
    loginStreak?: number;
    role?: string;
  }
}
