-- Migration 0012: Replace flat address with 6 structured fields + personal_email

-- Add structured address columns
alter table profiles add column if not exists addr_door     text;
alter table profiles add column if not exists addr_building text;
alter table profiles add column if not exists addr_street   text;
alter table profiles add column if not exists addr_city     text;
alter table profiles add column if not exists addr_state    text;
alter table profiles add column if not exists addr_pincode  text;
alter table profiles add column if not exists personal_email text;

-- Migrate any existing single-field address data into addr_street (best-effort)
update profiles set addr_street = address where address is not null and addr_street is null;

-- Drop the old flat column (optional, safe to keep for now — we stop using it in code)
-- alter table profiles drop column if exists address;
-- Keeping it to avoid breaking any existing FK/query that may reference it.
