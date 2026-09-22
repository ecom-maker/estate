import {
  PrismaClient,
  PropertyType,
  PropertyStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "../lib/rbac/permissions";

const prisma = new PrismaClient();

/** Default admin login for seeded environments (change in production). */
const ADMIN_EMAIL = "admin@dmproperties.ai";
const ADMIN_PASSWORD = "Admin123!";

async function main() {
  console.log("Seeding DMProperties AI (fictional/seed data)...");

  const company = await prisma.company.upsert({
    where: { slug: "dmproperties" },
    update: {},
    create: { name: "DMProperties", slug: "dmproperties" },
  });

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  const roles = ["SUPER_ADMIN", "COMPANY_ADMIN", "AGENT", "CUSTOMER"] as const;
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: name },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const superAdmin = await prisma.role.findUniqueOrThrow({
    where: { name: "SUPER_ADMIN" },
  });
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: superAdmin.id, permissionId: permission.id },
    });
  }

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash: adminPasswordHash,
      name: "Super Admin",
      companyId: company.id,
    },
    create: {
      email: ADMIN_EMAIL,
      name: "Super Admin",
      companyId: company.id,
      passwordHash: adminPasswordHash,
      emailVerified: new Date(),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdmin.id },
  });
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  const agentRole = await prisma.role.findUniqueOrThrow({
    where: { name: "AGENT" },
  });
  for (const [email, name] of [
    ["agent1@dmproperties.ai", "Layla Agent"],
    ["agent2@dmproperties.ai", "Omar Agent"],
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, companyId: company.id },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: agentRole.id } },
      update: {},
      create: { userId: user.id, roleId: agentRole.id },
    });
  }

  const customerRole = await prisma.role.findUniqueOrThrow({
    where: { name: "CUSTOMER" },
  });
  for (const [email, name] of [
    ["guest1@example.com", "Aisha Guest"],
    ["guest2@example.com", "Noah Guest"],
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, companyId: company.id },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: customerRole.id } },
      update: {},
      create: { userId: user.id, roleId: customerRole.id },
    });
  }

  const developers = await Promise.all(
    [
      ["Nakheel", "nakheel"],
      ["Emaar", "emaar"],
      ["Select Group", "select-group"],
    ].map(([name, slug]) =>
      prisma.developer.upsert({
        where: { slug },
        update: {},
        create: {
          name,
          slug,
          description: `SEED DATA — ${name} developer profile.`,
        },
      }),
    ),
  );

  const communities = await Promise.all(
    [
      ["Palm Jumeirah", "palm-jumeirah", "Dubai", 25.1124, 55.1389],
      ["Downtown Dubai", "downtown-dubai", "Dubai", 25.1972, 55.2744],
      ["Emirates Hills", "emirates-hills", "Dubai", 25.068, 55.174],
      ["Dubai Marina", "dubai-marina", "Dubai", 25.0805, 55.1403],
    ].map(([name, slug, city, lat, lng]) =>
      prisma.community.upsert({
        where: { slug: String(slug) },
        update: {},
        create: {
          name: String(name),
          slug: String(slug),
          city: String(city),
          emirate: "Dubai",
          latitude: Number(lat),
          longitude: Number(lng),
          description: `SEED DATA — ${name} community guide.`,
        },
      }),
    ),
  );

  const amenityNames = [
    "Private Beach",
    "Pool",
    "Smart Home",
    "Concierge",
    "Gym",
    "Parking",
    "Terrace",
    "Sea View",
    "Maid Room",
    "Garden",
  ];
  const amenities = [];
  for (const name of amenityNames) {
    amenities.push(
      await prisma.amenity.upsert({
        where: { name },
        update: {},
        create: {
          name,
          iconSlug: name.toLowerCase().replace(/\s+/g, "-"),
        },
      }),
    );
  }

  await prisma.airport.upsert({
    where: { id: "seed-airport-dxb" },
    update: {},
    create: {
      id: "seed-airport-dxb",
      name: "Dubai International Airport",
      code: "DXB",
      latitude: 25.2532,
      longitude: 55.3657,
    },
  });

  const palm = communities.find((c) => c.slug === "palm-jumeirah")!;
  await prisma.school.createMany({
    data: [
      {
        name: "SEED — Palm International School",
        curriculum: "IB",
        rating: 4.6,
        communityId: palm.id,
        latitude: 25.118,
        longitude: 55.14,
      },
    ],
    skipDuplicates: true,
  });
  await prisma.metro.createMany({
    data: [
      {
        name: "SEED — Palm Jumeirah Monorail",
        line: "Palm",
        communityId: palm.id,
        latitude: 25.116,
        longitude: 55.137,
      },
    ],
    skipDuplicates: true,
  });

  const listings: Array<{
    title: string;
    slug: string;
    type: PropertyType;
    priceAed: number;
    bedrooms: number;
    bathrooms: number;
    areaSqft: number;
    communitySlug: string;
    developerSlug: string;
    waterfront?: boolean;
    privateBeach?: boolean;
    offPlan?: boolean;
    rentalYield?: number;
    image: string;
    amenityNames: string[];
  }> = [
    {
      title: "Palm Frond Signature Villa",
      slug: "palm-frond-signature-villa",
      type: PropertyType.VILLA,
      priceAed: 28500000,
      bedrooms: 5,
      bathrooms: 6,
      areaSqft: 9200,
      communitySlug: "palm-jumeirah",
      developerSlug: "nakheel",
      waterfront: true,
      privateBeach: true,
      rentalYield: 4.2,
      image:
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Private Beach", "Pool", "Smart Home", "Garden"],
    },
    {
      title: "Downtown Sky Residence",
      slug: "downtown-sky-residence",
      type: PropertyType.APARTMENT,
      priceAed: 9800000,
      bedrooms: 3,
      bathrooms: 4,
      areaSqft: 2400,
      communitySlug: "downtown-dubai",
      developerSlug: "emaar",
      rentalYield: 5.1,
      image:
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Concierge", "Gym", "Parking"],
    },
    {
      title: "Marina Crown Penthouse",
      slug: "marina-crown-penthouse",
      type: PropertyType.PENTHOUSE,
      priceAed: 22000000,
      bedrooms: 4,
      bathrooms: 5,
      areaSqft: 6100,
      communitySlug: "dubai-marina",
      developerSlug: "select-group",
      waterfront: true,
      rentalYield: 4.8,
      image:
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Terrace", "Pool", "Sea View"],
    },
    {
      title: "Emirates Hills Golf Estate",
      slug: "emirates-hills-golf-estate",
      type: PropertyType.VILLA,
      priceAed: 45000000,
      bedrooms: 6,
      bathrooms: 7,
      areaSqft: 14000,
      communitySlug: "emirates-hills",
      developerSlug: "emaar",
      rentalYield: 3.6,
      image:
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Pool", "Garden", "Maid Room", "Parking"],
    },
    {
      title: "Palm Minimalist Beach Villa",
      slug: "palm-minimalist-beach-villa",
      type: PropertyType.VILLA,
      priceAed: 24900000,
      bedrooms: 5,
      bathrooms: 5,
      areaSqft: 8500,
      communitySlug: "palm-jumeirah",
      developerSlug: "nakheel",
      waterfront: true,
      privateBeach: true,
      rentalYield: 4.0,
      image:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Private Beach", "Pool", "Smart Home"],
    },
    {
      title: "Business Bay Canal Residence",
      slug: "business-bay-canal-residence",
      type: PropertyType.APARTMENT,
      priceAed: 6200000,
      bedrooms: 2,
      bathrooms: 3,
      areaSqft: 1600,
      communitySlug: "downtown-dubai",
      developerSlug: "emaar",
      offPlan: true,
      image:
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Gym", "Parking", "Concierge"],
    },
    {
      title: "Marina Gate Dual Aspect",
      slug: "marina-gate-dual-aspect",
      type: PropertyType.APARTMENT,
      priceAed: 7500000,
      bedrooms: 3,
      bathrooms: 3,
      areaSqft: 1900,
      communitySlug: "dubai-marina",
      developerSlug: "select-group",
      waterfront: true,
      rentalYield: 5.4,
      image:
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Sea View", "Gym", "Parking"],
    },
    {
      title: "Palm Frond Garden Townhouse",
      slug: "palm-frond-garden-townhouse",
      type: PropertyType.TOWNHOUSE,
      priceAed: 16000000,
      bedrooms: 4,
      bathrooms: 5,
      areaSqft: 4200,
      communitySlug: "palm-jumeirah",
      developerSlug: "nakheel",
      waterfront: false,
      rentalYield: 4.5,
      image:
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cd00?auto=format&fit=crop&w=1600&q=80",
      amenityNames: ["Garden", "Pool", "Parking"],
    },
  ];

  for (const listing of listings) {
    const community = communities.find((c) => c.slug === listing.communitySlug)!;
    const developer = developers.find((d) => d.slug === listing.developerSlug)!;
    const property = await prisma.property.upsert({
      where: { slug: listing.slug },
      update: {
        priceAed: listing.priceAed,
        status: PropertyStatus.ACTIVE,
      },
      create: {
        companyId: company.id,
        source: "seed",
        externalId: listing.slug,
        title: listing.title,
        slug: listing.slug,
        type: listing.type,
        status: PropertyStatus.ACTIVE,
        description: `SEED DATA — ${listing.title}. Fictional listing for development and demos.`,
        priceAed: listing.priceAed,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        areaSqft: listing.areaSqft,
        waterfront: listing.waterfront ?? false,
        privateBeach: listing.privateBeach ?? false,
        offPlan: listing.offPlan ?? false,
        ready: listing.offPlan ? false : true,
        rentalYield: listing.rentalYield,
        reraStatus: "SEED — RERA registered (fictional)",
        communityId: community.id,
        developerId: developer.id,
        latitude: community.latitude,
        longitude: community.longitude,
        paymentPlan: listing.offPlan
          ? { downPaymentPct: 20, duringConstructionPct: 50, onHandoverPct: 30 }
          : undefined,
        metadata: { seed: true },
      },
    });

    await prisma.propertyImage.deleteMany({ where: { propertyId: property.id } });
    await prisma.propertyImage.create({
      data: {
        propertyId: property.id,
        url: listing.image,
        alt: listing.title,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    await prisma.propertyUnit.upsert({
      where: {
        propertyId_unitNumber: {
          propertyId: property.id,
          unitNumber: "U-01",
        },
      },
      update: {},
      create: {
        propertyId: property.id,
        unitNumber: "U-01",
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        areaSqft: listing.areaSqft,
        priceAed: listing.priceAed,
        view: listing.waterfront ? "Sea" : "Community",
        status: "available",
      },
    });

    for (const amenityName of listing.amenityNames) {
      const amenity = amenities.find((a) => a.name === amenityName);
      if (!amenity) continue;
      await prisma.propertyAmenity.upsert({
        where: {
          propertyId_amenityId: {
            propertyId: property.id,
            amenityId: amenity.id,
          },
        },
        update: {},
        create: { propertyId: property.id, amenityId: amenity.id },
      });
    }

    if (listing.rentalYield) {
      await prisma.rentalHistory.create({
        data: {
          propertyId: property.id,
          rentedAt: new Date("2025-01-15"),
          annualRentAed: Math.round(
            (listing.priceAed * listing.rentalYield) / 100,
          ),
          source: "seed",
        },
      });
    }
  }

  await prisma.promptTemplate.upsert({
    where: { key: "system" },
    update: {},
    create: {
      key: "system",
      name: "System",
      content:
        "You are DMProperties AI. Never invent property facts. Distinguish known data vs estimates.",
    },
  });

  await prisma.aiSetting.upsert({
    where: { key: "llm" },
    update: {},
    create: {
      key: "llm",
      value: {
        provider: "openai",
        model: "gpt-4.1-mini",
        temperature: 0.2,
        streaming: true,
        enabled: true,
        apiKeyConfigured: false,
      },
    },
  });

  await prisma.aiModelConfig.createMany({
    data: [
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        temperature: 0.2,
        enabled: true,
      },
    ],
    skipDuplicates: true,
  });

  const guide = await prisma.knowledgeDocument.upsert({
    where: { id: "seed-knowledge-palm" },
    update: { status: "chunked" },
    create: {
      id: "seed-knowledge-palm",
      title: "SEED — Palm Jumeirah Community Guide",
      sourceType: "community-guide",
      status: "processing",
      metadata: { seed: true },
    },
  });

  await prisma.documentChunk.deleteMany({ where: { documentId: guide.id } });
  await prisma.documentChunk.createMany({
    data: [
      {
        documentId: guide.id,
        chunkIndex: 0,
        content:
          "SEED DATA — Palm Jumeirah is a waterfront community in Dubai with villas, apartments, and private beach access on selected fronds. Schools and monorail access vary by frond.",
        tokenCount: 60,
      },
      {
        documentId: guide.id,
        chunkIndex: 1,
        content:
          "SEED DATA — Investment notes for Palm Jumeirah should cite known rental history only. Do not invent yields. Airport proximity is typically 30–45 minutes depending on traffic.",
        tokenCount: 55,
      },
    ],
  });
  await prisma.knowledgeDocument.update({
    where: { id: guide.id },
    data: { status: "chunked" },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
