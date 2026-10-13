import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * A listing's own development lives under /projects now (projects are the
 * developments; /properties lists individual units). Old property-detail URLs
 * permanently redirect to the project page.
 */
export default async function LegacyPropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/projects/${slug}`);
}
