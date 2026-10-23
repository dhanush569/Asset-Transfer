-- Machine Asset Transfer v2 — run ONCE in Supabase SQL Editor.
-- WARNING: drops the old tables (all old test data is removed).
drop table if exists transfers cascade;
drop table if exists users cascade;
drop table if exists plants cascade;
drop table if exists companies cascade;

create table plants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null,
  created_at timestamptz not null default now()
);

create table transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique,
  status text not null default 'draft' check (status in ('draft','pending','verified')),
  machine_name text not null default '',
  sap_no text not null default '',
  equipment_no text not null default '',
  source_plant_id uuid references plants(id) on delete set null,
  source_plant_name text not null default '',
  destination_plant_id uuid references plants(id) on delete set null,
  destination_plant_name text not null default '',
  receiver_email text not null default '',
  machine_photos jsonb not null default '[]',
  has_electrical boolean not null default false,
  electrical_photos jsonb not null default '[]',
  electrical_checklist jsonb not null default '[]',
  has_mechanical boolean not null default false,
  mechanical_photos jsonb not null default '[]',
  mechanical_checklist jsonb not null default '[]',
  mechanical_overall_status text not null default '',
  missing_parameters text not null default '',
  missing_photo_url text not null default '',
  abnormalities text not null default '',
  abnormality_photo_url text not null default '',
  receiver_review jsonb not null default '{}',
  access_code_hash text,
  access_code_expires timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  verified_at timestamptz
);
create index transfers_status_idx on transfers (status);

alter table plants enable row level security;
alter table transfers enable row level security;