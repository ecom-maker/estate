import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserLLMView } from "@/lib/ai/user-llm";
import { LlmForm } from "@/components/account/llm-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My LLM" };

export default async function AccountLlmPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Faccount%2Fllm");

  const view = await getUserLLMView(session.user.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <Link href="/account" className="text-sm text-accent hover:underline">
        ← Back to profile
      </Link>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Account
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">My LLM</h1>
      <p className="mt-3 text-sm text-muted">
        Bring your own OpenAI-compatible LLM. When enabled, your searches and
        chat use your key — billed to your account, not the shared one. Your key
        is stored encrypted and never shown again.
      </p>

      <LlmForm initial={view} />
    </div>
  );
}
