-- DRAFT schema for Neon Postgres. Not applied anywhere yet.
-- Mirrors the mock data in src/lib/api.ts and src/lib/auth.ts.
-- Users come from Clerk; we keep a local row keyed by the Clerk user id.

create table users (
  id          text primary key,            -- Clerk user id (user_xxx)
  email       text not null unique,
  name        text,
  phone       text,
  company     text,
  created_at  timestamptz not null default now()
);

-- Price list, loaded from data/pricing.csv + data/packages.csv.
create table services (
  id            text primary key,          -- ASC-0001
  category      text not null,
  name          text not null,
  status        text not null check (status in ('open', 'soon')),
  pricing_type  text not null check (pricing_type in ('package', 'fixed', 'starting')),
  small_price   integer,                   -- INR, excl. GST; null = on quote
  small_unit    text,
  mid_price     integer,
  mid_unit      text,
  market_rate   text,
  notes         text
);

create table service_packages (
  service_id  text not null references services(id),
  key         text not null,               -- starter | basic | business | professional | premium | custom
  name        text not null,
  price       integer,                     -- null = custom quote
  includes    text,
  delivery    text,
  primary key (service_id, key)
);

create table estimates (
  id          text primary key,
  user_id     text not null references users(id),
  biz_size    text not null check (biz_size in ('small', 'mid')),
  status      text not null default 'submitted',
  note        text,
  created_at  timestamptz not null default now()
);

create table estimate_items (
  id           bigint generated always as identity primary key,
  estimate_id  text not null references estimates(id) on delete cascade,
  service_id   text not null references services(id),
  package_key  text,
  qty          integer not null default 1,
  unit_price   integer,                    -- snapshot at submit time
  recurrence   text not null               -- once | month | quarter | year
);


-- Dynamic Service Pricing & Coming Soon Controls
CREATE TABLE IF NOT EXISTS service_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code VARCHAR(50) NOT NULL UNIQUE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  type VARCHAR(50) NOT NULL DEFAULT 'starting',
  small_price NUMERIC(12, 2),
  small_text VARCHAR(255) DEFAULT '',
  small_unit VARCHAR(255) DEFAULT '',
  small_detail TEXT DEFAULT '',
  mid_price NUMERIC(12, 2),
  mid_text VARCHAR(255) DEFAULT '',
  mid_unit VARCHAR(255) DEFAULT '',
  mid_detail TEXT DEFAULT '',
  billing VARCHAR(255) DEFAULT '',
  market VARCHAR(500) DEFAULT '',
  notes TEXT DEFAULT '',
  packages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_pricing_code_uidx ON service_pricing(service_code);
CREATE INDEX IF NOT EXISTS service_pricing_status_idx ON service_pricing(status);
CREATE INDEX IF NOT EXISTS service_pricing_type_idx ON service_pricing(type);
CREATE INDEX IF NOT EXISTS service_pricing_service_id_idx ON service_pricing(service_id);
