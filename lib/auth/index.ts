import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { verifyOtp } from "@/lib/auth/otp-store";

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

providers.push(
  Credentials({
    id: "phone-otp",
    name: "Phone OTP",
    credentials: {
      phone: { label: "Phone", type: "text" },
      code: { label: "Code", type: "text" },
    },
    async authorize(credentials) {
      const phone = String(credentials?.phone ?? "");
      const code = String(credentials?.code ?? "");
      if (!phone || !code) return null;
      const valid = verifyOtp(phone, code);
      if (!valid) return null;

      const user = await prisma.user.upsert({
        where: { phone },
        update: { phoneVerified: new Date() },
        create: {
          phone,
          phoneVerified: new Date(),
          name: `Guest ${phone.slice(-4)}`,
        },
        include: { roles: { include: { role: true } } },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { roles: { include: { role: true } } },
        });
        token.roles = dbUser?.roles.map((r) => r.role.name) ?? [];
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
});
