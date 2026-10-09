import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";

/**
 * Google One Tap / "Sign in with Google" button sign-in.
 *
 * The browser gets a Google-signed ID token (JWT) straight from Google; we
 * verify its signature, issuer and audience, then find or create the user and
 * link the Google account, the same way the OAuth Google provider would, so a
 * later redirect-based Google sign-in lands on the same account.
 */

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

type GoogleIdClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function verifyGoogleIdToken(
  credential: string,
  clientId: string,
  keys: Parameters<typeof jwtVerify>[1] = GOOGLE_JWKS,
) {
  const { payload } = await jwtVerify(credential, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  return payload as unknown as GoogleIdClaims;
}

export async function signInWithGoogleIdToken(credential: string, clientId: string) {
  const claims = await verifyGoogleIdToken(credential, clientId);
  if (!claims.sub || !claims.email || claims.email_verified !== true) return null;
  const email = claims.email.toLowerCase();

  // Already linked to a user?
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: claims.sub } },
    include: { user: true },
  });
  if (linked) return linked.user;

  // Same verified email as an existing user: link it. Otherwise create one.
  const user = await prisma.user.upsert({
    where: { email },
    update: { emailVerified: new Date() },
    create: {
      email,
      emailVerified: new Date(),
      name: claims.name ?? null,
      image: claims.picture ?? null,
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: claims.sub,
    },
  });
  return user;
}
