-- audit_log: tabell for admin-handlinger
-- Kjør én gang i Supabase SQL Editor.

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  tidsstempel   timestamptz not null default now(),
  admin_id      uuid references public.admin_brukere(id) on delete set null,
  admin_epost   text,
  handling      text not null,
  entitet       text,
  entitet_id    text,
  beskrivelse   text,
  metadata      jsonb
);

create index if not exists audit_log_tidsstempel_idx on public.audit_log (tidsstempel desc);
create index if not exists audit_log_entitet_idx on public.audit_log (entitet);
create index if not exists audit_log_handling_idx on public.audit_log (handling);

-- RLS: kun service-role skal skrive/lese (audit-koden bruker createAdminClient).
alter table public.audit_log enable row level security;
-- Ingen policies = ingen tilgang for anon/authenticated. Service-role bypasser RLS.
