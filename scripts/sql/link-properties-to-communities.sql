-- Link every property to a correct Community record.
--
-- Context: all 7 properties were already linked, but "Business Bay Canal
-- Residence" pointed at "Downtown Dubai", and there was no "Business Bay"
-- community row at all. This script (a) seeds the canonical Dubai communities
-- that were missing and (b) re-derives each property's community from its
-- title so mislabeled rows are corrected.
--
-- Safe to re-run: inserts are ON CONFLICT DO NOTHING, updates only touch rows
-- whose community_id is not already correct.
--
-- Run in the Supabase SQL editor.

-- 1) Seed canonical communities (idempotent on the unique slug).
INSERT INTO communities (id, name, slug, city, emirate, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'Palm Jumeirah',   'palm-jumeirah',   'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Downtown Dubai',  'downtown-dubai',  'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Dubai Marina',    'dubai-marina',    'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Emirates Hills',  'emirates-hills',  'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Business Bay',    'business-bay',    'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Arabian Ranches', 'arabian-ranches', 'Dubai', 'Dubai', now(), now()),
  (gen_random_uuid()::text, 'Jumeirah',        'jumeirah',        'Dubai', 'Dubai', now(), now())
ON CONFLICT (slug) DO NOTHING;

-- 2) Re-link each property to the community implied by its title.
--    Most specific patterns first so "Palm Jumeirah" wins over "Jumeirah".
--    Only rows that are not already correct are updated.

-- Business Bay (fixes "Business Bay Canal Residence", currently Downtown Dubai)
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'business-bay'
  AND (p.title ILIKE '%business bay%' OR p.slug ILIKE '%business-bay%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Emirates Hills
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'emirates-hills'
  AND (p.title ILIKE '%emirates hill%' OR p.slug ILIKE '%emirates-hill%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Palm Jumeirah (before Jumeirah)
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'palm-jumeirah'
  AND (p.title ILIKE '%palm%' OR p.slug ILIKE '%palm%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Downtown Dubai
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'downtown-dubai'
  AND (p.title ILIKE '%downtown%' OR p.slug ILIKE '%downtown%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Dubai Marina
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'dubai-marina'
  AND (p.title ILIKE '%marina%' OR p.slug ILIKE '%marina%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Arabian Ranches
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'arabian-ranches'
  AND (p.title ILIKE '%arabian%' OR p.title ILIKE '%ranches%'
       OR p.slug ILIKE '%arabian%' OR p.slug ILIKE '%ranches%')
  AND p.community_id IS DISTINCT FROM c.id;

-- Jumeirah (standalone) — only rows still unlinked and not Palm Jumeirah
UPDATE properties p
SET community_id = c.id, updated_at = now()
FROM communities c
WHERE c.slug = 'jumeirah'
  AND p.community_id IS NULL
  AND p.title ILIKE '%jumeirah%'
  AND p.title NOT ILIKE '%palm%';

-- 3) Verify: every property with its community, and flag any still unlinked.
SELECT p.title,
       COALESCE(c.name, '(UNLINKED)') AS community
FROM properties p
LEFT JOIN communities c ON c.id = p.community_id
WHERE p.deleted_at IS NULL
ORDER BY community, p.title;
