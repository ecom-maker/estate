import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { getRequestSiteUrl } from "@/lib/site-url";
import { verifyPartnerKey } from "@/lib/partners/keys";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

function keyFrom(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

/** Fetch one of the partner's own listings by its externalId. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  const partner = await verifyPartnerKey(keyFrom(request));
  if (!partner) return apiError(401, "Invalid or missing partner API key.");
  const { externalId } = await params;
  const siteUrl = await getRequestSiteUrl();

  const p = await prisma.property.findFirst({
    where: {
      source: `partner:${partner.partnerId}`,
      externalId,
      deletedAt: null,
    },
    select: {
      externalId: true,
      slug: true,
      title: true,
      status: true,
      priceAed: true,
      updatedAt: true,
    },
  });
  if (!p) return apiError(404, `No listing found for externalId '${externalId}'.`);

  return apiJson({
    externalId: p.externalId,
    title: p.title,
    status: p.status,
    price: { currency: "AED", amount: p.priceAed },
    url: `${siteUrl}/properties/${p.slug}`,
    updatedAt: p.updatedAt.toISOString(),
  });
}

/** Withdraw (soft-delete) one of the partner's own listings. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  const partner = await verifyPartnerKey(keyFrom(request));
  if (!partner) return apiError(401, "Invalid or missing partner API key.");
  const { externalId } = await params;

  const p = await prisma.property.findFirst({
    where: {
      source: `partner:${partner.partnerId}`,
      externalId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!p) return apiError(404, `No listing found for externalId '${externalId}'.`);

  await prisma.property.update({
    where: { id: p.id },
    data: { deletedAt: new Date(), status: "OFF_MARKET" },
  });

  return apiJson({ externalId, withdrawn: true });
}
