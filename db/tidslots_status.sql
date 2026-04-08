-- Utvid tidslots med status for periodisk utilgjengelighet
-- Kjør én gang i Supabase SQL Editor.

alter table public.tidslots
  add column if not exists status text not null default 'ledig'
  check (status in ('ledig', 'utilgjengelig'));

create index if not exists tidslots_status_idx on public.tidslots (status);

comment on column public.tidslots.status is
  'ledig = klubb_id null betyr søkbar; utilgjengelig = blokkert av admin (vedlikehold, fast bruk).';
