import { HeroChatBar } from "@/components/ai/hero-chat-bar";

export default function HomePage() {
  return (
    <section className="relative -mt-[65px] min-h-[100svh] overflow-hidden pt-[65px]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.5) 45%, rgba(15,23,42,0.78) 100%), url('https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2400&q=80')",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgba(15,23,42,0.55)_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[calc(100svh-65px)] max-w-7xl flex-col justify-end px-6 pb-16 pt-24 md:justify-center md:px-10 md:pb-24">
        <div className="max-w-3xl">
          <p className="mb-4 font-sans text-xs font-medium uppercase tracking-[0.28em] text-accent">
            DMProperties AI
          </p>
          <h1 className="font-serif text-4xl leading-tight text-white md:text-6xl md:leading-[1.1]">
            A luxury real estate advisor, powered by conversation.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            Describe the home you want. We extract intent, search inventory, and
            answer with clarity — never inventing what we do not know.
          </p>
        </div>

        <div className="mt-10">
          <HeroChatBar />
        </div>
      </div>
    </section>
  );
}
