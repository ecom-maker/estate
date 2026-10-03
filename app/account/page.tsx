import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AccountForm } from "@/components/account/account-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?error=AccessDenied");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Account
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">My profile</h1>
      <p className="mt-3 text-sm text-muted">
        Update your name, email, contact number and password.
      </p>

      <AccountForm
        initial={{
          name: user.name ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          hasPassword: Boolean(user.passwordHash),
        }}
      />

      <div className="mt-10 rounded-sm border border-border bg-card p-5">
        <h2 className="font-serif text-lg text-primary">Your AI (LLM)</h2>
        <p className="mt-1 text-sm text-muted">
          Add your own LLM key so your searches and chat run on your account
          instead of the shared one.
        </p>
        <Link
          href="/account/llm"
          className="mt-3 inline-block rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-primary hover:border-accent"
        >
          Manage my LLM
        </Link>
      </div>
    </div>
  );
}
