import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  toProjectCardData,
  projectCardInclude,
  type ProjectCardData,
} from "@/lib/property/project-card";
import { ProjectLanding } from "@/components/property/project-landing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ year: string }> };

/** A 4-digit handover year within a sane window (last year … +10). */
function validYear(year: string): number | null {
  if (!/^\d{4}$/.test(year)) return null;
  const n = Number(year);
  const now = new Date().getUTCFullYear();
  return n >= now - 1 && n <= now + 10 ? n : null;
}

function handoverYear(metadata: unknown): number | null {
  const hd = (metadata as { handoverDate?: string } | null)?.handoverDate;
  if (!hd) return null;
  const d = new Date(hd);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  const y = validYear(year);
  if (!y) return { title: "Handover" };
  return {
    title: `Off-Plan Properties with Handover in ${y} | Dubai`,
    description: `Off-plan developments in Dubai handing over in ${y} — verified projects, unit types and starting prices from leading developers.`,
    alternates: { canonical: `/handover/${y}` },
  };
}

export default async function HandoverYearPage({ params }: Props) {
  const { year } = await params;
  const y = validYear(year);
  if (!y) notFound();

  let projects: ProjectCardData[] = [];
  try {
    const rows = await prisma.property.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "RESERVED"] },
        offPlan: true,
      },
      include: projectCardInclude,
      orderBy: { createdAt: "desc" },
    });
    projects = rows
      .filter((p) => handoverYear(p.metadata) === y)
      .map(toProjectCardData);
  } catch {
    projects = [];
  }

  return (
    <ProjectLanding
      path={`/handover/${y}`}
      eyebrow={`Off-plan · Handover ${y}`}
      heading={`Properties handing over in ${y}`}
      intro={`Off-plan developments in Dubai scheduled for handover in ${y}. Handover dates shown are from verified project data.`}
      projects={projects}
    />
  );
}
