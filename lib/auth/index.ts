import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { verifyOtp } from "@/lib/auth/otp-store";
import type { NextAuthConfig } from "next-auth";

const providers: NextAuthConfig["providers"] = [];

const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
export const isGoogleAuthEnabled = Boolean(googleId && googleSecret);

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  console.error(
    "[auth] Missing AUTH_SECRET / NEXTAUTH_SECRET in environment variables.",
  );
}

if (isGoogleAuthEnabled) {
  providers.push(
    Google({
      clientId: googleId!,
      clientSecret: googleSecret!,
    }),
  );
}

providers.push(
  Credentials({
    id: "credentials",
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      } catch (error) {
        console.error("[auth] credentials authorize failed", error);
        return null;
      }
    },
  }),
);

providers.push(
  Credentials({
    id: "phone-otp",
    name: "Phone OTP",
    credentials: {
      phone: { label: "Phone", type: "text" },
      code: { label: "Code", type: "text" },
    },
    async authorize(credentials) {
      const phone = String(credentials?.phone ?? "").replace(/\s+/g, "");
      const code = String(credentials?.code ?? "").trim();
      if (!phone || !code) return null;

      const valid = verifyOtp(phone, code);
      if (!valid) return null;

      try {
        const user = await prisma.user.upsert({
          where: { phone },
          update: { phoneVerified: new Date() },
          create: {
            phone,
            phoneVerified: new Date(),
            name: `Guest ${phone.slice(-4)}`,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      } catch (error) {
        console.error("[auth] phone-otp authorize failed", error);
        return null;
      }
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            include: { roles: { include: { role: true } } },
          });
          token.roles = dbUser?.roles.map((r) => r.role.name) ?? [];
        } catch (error) {
          console.error("[auth] jwt role lookup failed", error);
          token.roles = [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { roles?: string[] }).roles =
          (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
});
