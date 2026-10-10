-- Migration 0013: Add extended fields for Student Profile page

alter table profiles add column if not exists blood_group text;
alter table profiles add column if not exists grade text;
alter table profiles add column if not exists section text;
alter table profiles add column if not exists roll_number text;
alter table profiles add column if not exists father_name text;
alter table profiles add column if not exists father_mobile text;
alter table profiles add column if not exists mother_name text;
alter table profiles add column if not exists mother_mobile text;
