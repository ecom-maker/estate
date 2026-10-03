import Link from "next/link";
import {
  Search,
  Heart,
  Bookmark,
  Users,
  CalendarClock,
  MessagesSquare,
} from "lucide-react";

export const metadata = { title: "Agent" };

const cards = [
  {
    title: "AI Search",
    href: "/search",
    desc: "Run a conversational property search.",
    Icon: Search,
  },
  {
    title: "Favorites",
    href: "/agent/favorites",
    desc: "Properties you've saved.",
    Icon: Heart,
  },
  {
    title: "Saved Searches",
    href: "/agent/saved-searches",
    desc: "Your stored search criteria.",
    Icon: Bookmark,
  },
  {
    title: "Customers",
    href: "/agent/customers",
    desc: "Registered customers.",
    Icon: Users,
  },
  {
    title: "Appointments",
    href: "/agent/appointments",
    desc: "Viewings and meetings.",
    Icon: CalendarClock,
  },
  {
    title: "Chat History",
    href: "/agent/chat-history",
    desc: "Past assistant conversations.",
    Icon: MessagesSquare,
  },
];

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Agent workspace
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Dashboard</h1>
      <p className="mt-2 text-sm text-muted">
        AI search, favorites, saved searches, customers, and chat history.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {cards.map(({ title, href, desc, Icon }) => (
          <Link
            key={title}
            href={href}
            className="group rounded-sm border border-border bg-card p-5 transition hover:border-accent hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl text-primary">{title}</h2>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent transition group-hover:bg-accent group-hover:text-primary-foreground">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">{desc}</p>
            <span className="mt-4 inline-block text-sm font-medium text-accent">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
