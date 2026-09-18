# DMProperties AI — Gap Analysis (cloned repo vs. build plan)

> **Repo:** `ecom-maker/estate` @ `4356fb6` · **Analyzed:** 2026-08-13 · Read-only, no code changed.
> **Compares against:** `docs/BUILD-PLAN.md` (the plan with the 4 agreed additions).

## Verdict

The clone is a strong, well-architected foundation — roughly **Milestones 1–3 already built**
(auth, RBAC, property catalog, AI/RAG, external connectors, admin UI, tests, CI). It faithfully
implements the core safety rules (LLM → Zod → Search → Prisma; secrets encrypted at rest).

**But it was built to the original UAE-only / external-CRM-only brief.** The four enhancements
we added to the plan are not in it. None require a rewrite — the model separation and connector
normalization layer make them clean *extensions*.

---

## What already exists (keep as-is)

| Area | Evidence |
|---|---|
| Auth + sessions | Auth.js: `User/Account/Session/VerificationToken`, `middleware.ts`, `lib/auth` |
| RBAC | `Role/Permission/UserRole/RolePermission`; `lib/rbac/{check,guards,permissions}.ts`; roles SUPER_ADMIN/COMPANY_ADMIN/AGENT/CUSTOMER |
| Property catalog | `Property`, `PropertyUnit`, images/videos/documents/floorplans, `Amenity` |
| AI / RAG | `ChatSession/Message`, `KnowledgeDocument/DocumentChunk (vector(1536))`, `PromptTemplate`, `AiModelConfig`, `AiLog`; `lib/ai`, `lib/search` |
| External connectors | `ApiProvider/ApiCredential(encrypted)/ApiSyncJob/ApiSyncLog`; `lib/connectors/{crm,mls,transactions}`, `lib/sync` |
| Admin UI | `app/admin/{properties,api-connectors,ai,knowledge-base,analytics}` |
| Infra | Docker compose (PG 55432 / Redis 6380), CI workflow, Vitest + Playwright |

---

## Gap 1 — Multi-country (currently UAE-hardcoded)

**Now:** `Property.priceAed`, `PropertyUnit.priceAed`, `SalesHistory.priceAed`,
`RentalHistory.annualRentAed`, `OffplanHistory.priceAed`; `Community.emirate`;
`NormalizedProperty.priceAED` (`lib/connectors/types.ts`). No country/currency concept.

**Change-set:**
- New `Country` (isoCode, defaultCurrency, defaultLocale, defaultAreaUnit, enabled) and `City` models.
- Add `countryId` to `Property`, `Community`, `School`, `Metro`, `Airport`, `Developer`, transaction tables.
- Add `currencyCode` alongside every money field. Keep `priceAed` as a transitional alias or migrate → `price`+`currencyCode` (recommend migrate; seed data is fictional so low risk).
- Add `areaUnit` (sqft|sqm) to `Property`/`PropertyUnit`.
- Generalize `NormalizedProperty` → `price` + `currencyCode` + `countryIso`; adapters map into it.
- UI/search: currency-aware formatting; country filter in `lib/search` + search pages.

**Touches:** `prisma/schema.prisma`, `lib/connectors/*`, `lib/search/*`, `prisma/seed`, search/detail UI. **Migration required.**

## Gap 2 — Native CRM module (missing entirely)

**Now:** Only *external* CRM sync exists (`ConnectorType.CRM`). RBAC has `customers.view/manage`
permissions but **no backing entities** — it's a placeholder. No Lead/Contact/Deal/Pipeline.

**Change-set:**
- New models: `Lead`, `Contact`, `Pipeline`, `PipelineStage`, `Deal`, `Activity`, `Task`, `CrmNote` (per BUILD-PLAN §5.7), all agent-scoped (`assignedAgentId`/`ownerAgentId`).
- Wire the existing CRM connector's `normalize()` to also produce Leads/Contacts/Deals (external CRM → native models), not just properties.
- Website/AI-chat lead capture → `Lead`.
- New RBAC permissions: `crm.leads.*`, `crm.deals.*`, `crm.contacts.*`; grant to AGENT/COMPANY_ADMIN.
- New UI: `app/agent/crm/*` (pipeline Kanban, lead/contact/deal views).

**Touches:** schema, `lib/connectors/crm`, `lib/rbac/permissions.ts`, new `app/agent/crm`, new `lib/crm`. **Migration required.** Largest of the four.

## Gap 3 — Agent publishing workflow (partial)

**Now:** `app/agent/page.tsx` is a single stub page. `PropertyStatus` = `DRAFT/ACTIVE/RESERVED/SOLD/OFF_MARKET`
(no review states). **AGENT role lacks `properties.create`/`properties.update`** — so agents can't
create or publish listings today. No `listedByAgentId`/`reviewedById`/`publishedAt`.

**Change-set:**
- Add listing lifecycle: extend `PropertyStatus` (or add `listingStatus`) with `PENDING_REVIEW`/`REJECTED`; add `listedByAgentId`, `submittedAt`, `reviewedById`, `reviewNote`, `publishedAt` to `Property`; add `AGENT` to source.
- Grant AGENT `properties.create` + `properties.update` (own listings only — enforce ownership in guards).
- Public portal + AI search filter to `PUBLISHED`/`ACTIVE` only (verify `lib/search` already does, tighten if not).
- New UI: agent listing create/edit + submit-for-review; admin review queue (approve/reject) in `app/admin/properties`.
- Config flag: trusted agents publish directly (skip review).

**Touches:** schema, `lib/rbac`, `lib/search`, `app/agent/*`, `app/admin/properties`. **Migration required (enum + columns).**

## Gap 4 — Building/project + unit/building transaction history (missing)

**Now:** `SalesHistory`/`RentalHistory`/`OffplanHistory` link **only** to `propertyId`. No `Building`
entity; no `unitId`/`buildingId`. Can't do "history for this exact unit" or "comparables in the
same building/project."

**Change-set:**
- New `Building` (a.k.a. Project/Development) model; add `buildingId?` to `Property`.
- Add `unitId?` + `buildingId?` to all three history tables; make `propertyId` optional (at least one anchor required).
- Add `source` (SYNC|MANUAL) + `notes` so agents/admins can hand-enter historical deals.
- Detail page: "this unit's history" + "same building/project comparables" sections.
- Transaction adapter maps into unit/building where the external feed provides it.

**Touches:** schema, `lib/connectors/transactions`, property detail UI, new manual-entry form. **Migration required.**

---

## Suggested implementation order (most schema-impactful first)

1. **Gap 1 (multi-country)** — foundational; every other table gains `countryId`/`currencyCode`. Do first so later migrations build on it.
2. **Gap 4 (Building + unit/building history)** — small, structural, unblocks richer detail pages and AI comparables.
3. **Gap 3 (agent publishing)** — mostly RBAC + status + UI; low schema risk.
4. **Gap 2 (native CRM)** — largest; build once the catalog/country model is settled.

Each is an independent, migratable increment with its own tests.

## Notes / risks

- **Seed data is fictional** → money-field migration (`priceAed` → `price`+`currencyCode`) is low-risk; do it cleanly rather than carrying an alias.
- **`vector(1536)`** is hardcoded in `DocumentChunk` — fine if staying on `text-embedding-3-small`; revisit only if the embedding model changes.
- **Docker not installed locally** → needed to run PG+Redis and exercise migrations. Install Docker Desktop before running/verifying any of the above.
- No changes made to the repo by this analysis.
