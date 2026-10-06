-- Real DLD transaction records (Bayut / Happy Endpoint) behind the
-- "similar properties" transactions table and price trend on property pages.
--
-- Market-wide and deliberately not linked to `properties`: an off-plan tower
-- has no transaction history of its own, so a listing is matched to its
-- comparables by community + bedrooms at query time.
CREATE TABLE IF NOT EXISTS "market_transactions" (
    "transaction_hash_id" TEXT NOT NULL,
    "purpose"             TEXT NOT NULL,
    "transacted_on"       DATE NOT NULL,
    "amount_aed"          DOUBLE PRECISION,
    "amount_per_sqm"      DOUBLE PRECISION,
    "area_sqm"            DOUBLE PRECISION,
    "bedrooms"            TEXT,
    "floor"               TEXT,
    "property_type_id"    TEXT,
    "emirate_community"   TEXT,
    "sub_community"       TEXT,
    "building"            TEXT,
    "leaf_location"       TEXT,
    "location_id"         TEXT,
    "completion_status"   TEXT,
    "sale_market"         TEXT,
    "monthly_rent_aed"    DOUBLE PRECISION,
    "contract_months"     TEXT,
    "latitude"            DOUBLE PRECISION,
    "longitude"           DOUBLE PRECISION,
    "source"              TEXT NOT NULL DEFAULT 'bayut-happyendpoint',
    "imported_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_transactions_pkey" PRIMARY KEY ("transaction_hash_id")
);

CREATE INDEX IF NOT EXISTS "market_transactions_emirate_community_transacted_on_idx"
    ON "market_transactions" ("emirate_community", "transacted_on");
CREATE INDEX IF NOT EXISTS "market_transactions_building_transacted_on_idx"
    ON "market_transactions" ("building", "transacted_on");

-- Every table in this database has RLS on; the app connects as the owner, which
-- RLS does not restrict, while the public anon key reads nothing.
ALTER TABLE "market_transactions" ENABLE ROW LEVEL SECURITY;
