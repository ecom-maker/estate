import { SavedPropertiesList } from "@/components/property/saved-properties-list";

export const metadata = {
  title: "Saved Properties",
  // Per-visitor, localStorage-backed list — nothing for search engines.
  robots: { index: false, follow: true },
};

export default function SavedPropertiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Your list
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Saved Properties</h1>
      <p className="mt-2 text-sm text-muted">
        Properties and projects you&rsquo;ve saved, most recent first.
      </p>
      <div className="mt-8">
        <SavedPropertiesList />
      </div>
    </div>
  );
}
