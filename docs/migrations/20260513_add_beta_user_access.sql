create table if not exists public.beta_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  access_code text,
  is_beta boolean not null default true,
  beta_cohort_week integer not null default 1 check (beta_cohort_week between 1 and 12),
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beta_user_access enable row level security;

create policy "Users can read their own beta access"
  on public.beta_user_access
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own beta access record"
  on public.beta_user_access
  for insert
  to authenticated
  with check (auth.uid() = user_id and beta_cohort_week = 1 and is_beta = true and status = 'active');

create or replace function public.set_beta_user_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_beta_user_access_updated_at on public.beta_user_access;
create trigger set_beta_user_access_updated_at
before update on public.beta_user_access
for each row
execute function public.set_beta_user_access_updated_at();
