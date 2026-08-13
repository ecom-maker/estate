import { SearchExperience } from "@/components/search/search-experience";

export const metadata = {
  title: "Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <SearchExperience initialQuery={params.q ?? ""} />;
}
