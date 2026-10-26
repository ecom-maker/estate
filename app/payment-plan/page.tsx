import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import {
  toProjectCardData,
  projectCardInclude,
  type ProjectCardData,
} from "@/lib/property/project-card";
import { ProjectLanding } from "@/components/property/project-landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Off-Plan Properties with Payment Plans in Dubai",
  description:
    "Off-plan developments in Dubai offering flexible payment plans — pay in instalments through construction and on handover. Verified projects from leading developers.",
  alternates: { canonical: "/payment-plan" },
};

/** A payment plan is on file only when it's a non-empty object. */
function hasPaymentPlan(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

export default async function PaymentPlanPage() {
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
      .filter((p) => hasPaymentPlan(p.paymentPlan))
      .map(toProjectCardData);
  } catch {
    projects = [];
  }

  return (
    <ProjectLanding
      path="/payment-plan"
      eyebrow="Off-plan · Payment plans"
      heading="Properties with payment plans"
      intro="Off-plan developments in Dubai with flexible payment plans — spread payments across construction milestones and on handover. Every figure here comes from verified project data."
      projects={projects}
    />
  );
}
