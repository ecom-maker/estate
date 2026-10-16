import { SearchExperience } from "@/components/search/search-experience";

export const metadata = {
  title: "Search",
  // Internal search UI — not indexable landing pages. This drops the old
  // /search?q=<community> URLs flagged as "Duplicate without user-selected
  // canonical"; real locality pages live at /[listing]. Links still followed.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <SearchExperience initialQuery={params.q ?? ""} />;
}
