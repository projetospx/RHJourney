-- Visitas Técnicas — extensão segura do banco do RH Journey
-- Execute este arquivo UMA VEZ no SQL Editor do mesmo projeto Supabase do RH Journey.
-- O script é idempotente e não apaga nem altera os dados atuais do Journey.

begin;

create extension if not exists pgcrypto;

create or replace function public.vt_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create table if not exists public.vt_score_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  weights jsonb not null,
  source_weights jsonb not null,
  health_bands jsonb not null,
  active boolean not null default false,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vt_visits (
  id uuid primary key default gen_random_uuid(),
  visit_code text not null unique,
  operation_id uuid references public.operations(id) on delete restrict,
  operation_name text not null,
  regional_id uuid,
  regional_name text,
  period_label text,
  period_start date,
  period_end date,
  visit_type text not null default 'Diagnóstico crítico',
  objective text,
  owner_id uuid references public.profiles(id) on delete set null,
  owner_name text,
  main_reason text,
  status text not null default 'Rascunho'
    check (status in ('Rascunho','Em preparação','Agendada','Em andamento','Concluída','Cancelada')),
  baseline jsonb not null default '{}'::jsonb,
  preparation jsonb not null default '[]'::jsonb,
  score_general numeric(5,2) check (score_general between 0 and 100),
  score_band text,
  diagnosis_confidence numeric(5,2) check (diagnosis_confidence between 0 and 100),
  workspace_payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vt_stage_entries (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.vt_visits(id) on delete cascade,
  stage_key text not null,
  objective_score numeric(5,2) check (objective_score between 0 and 100),
  perception_score numeric(5,2) check (perception_score between 0 and 100),
  observation_score numeric(5,2) check (observation_score between 0 and 100),
  behavioral_scores jsonb not null default '{}'::jsonb,
  evidence text,
  counter_evidence text,
  payload jsonb not null default '{}'::jsonb,
  complete boolean not null default false,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, stage_key)
);

create table if not exists public.vt_interviews (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.vt_visits(id) on delete cascade,
  audience_type text not null check (audience_type in ('site','leader','employee')),
  interviewee_name text,
  role_title text,
  team text,
  notes text,
  perception_score numeric(5,2) check (perception_score between 0 and 100),
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vt_interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.vt_interviews(id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  question_text text not null,
  answer text,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, question_index)
);

create table if not exists public.vt_findings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.vt_visits(id) on delete cascade,
  source_interview_id uuid references public.vt_interviews(id) on delete set null,
  title text not null,
  category text,
  evidence text,
  probable_cause text,
  secondary_cause text,
  aggravators text[] not null default '{}',
  risk text,
  recommendation text,
  owner_name text,
  due_date date,
  status text not null default 'A iniciar',
  severity smallint not null default 3 check (severity between 1 and 5),
  frequency smallint not null default 3 check (frequency between 1 and 5),
  breadth smallint not null default 3 check (breadth between 1 and 5),
  urgency smallint not null default 3 check (urgency between 1 and 5),
  criticality_score numeric(8,2),
  criticality_band text,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vt_actions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.vt_visits(id) on delete cascade,
  finding_id uuid references public.vt_findings(id) on delete set null,
  title text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  owner_name text,
  due_date date,
  status text not null default 'A iniciar',
  priority text,
  follow_up_notes text,
  completed_at timestamptz,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vt_surveys (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.vt_visits(id) on delete cascade,
  operation_id uuid references public.operations(id) on delete restrict,
  title text not null,
  audience text,
  period_start date,
  period_end date,
  anonymity text,
  status text not null default 'Rascunho',
  invited_count integer check (invited_count >= 0),
  response_count integer check (response_count >= 0),
  overall_score numeric(5,2) check (overall_score between 0 and 100),
  results jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vt_visits_operation_idx on public.vt_visits(operation_id, updated_at desc);
create index if not exists vt_visits_status_idx on public.vt_visits(status, updated_at desc);
create index if not exists vt_stage_entries_visit_idx on public.vt_stage_entries(visit_id);
create index if not exists vt_interviews_visit_idx on public.vt_interviews(visit_id, audience_type);
create index if not exists vt_findings_visit_idx on public.vt_findings(visit_id, criticality_band);
create index if not exists vt_actions_visit_due_idx on public.vt_actions(visit_id, due_date);
create index if not exists vt_surveys_operation_idx on public.vt_surveys(operation_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vt_score_configs','vt_visits','vt_stage_entries','vt_interviews',
    'vt_interview_answers','vt_findings','vt_actions','vt_surveys'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists vt_rh_select on public.%I', table_name);
    execute format('drop policy if exists vt_rh_insert on public.%I', table_name);
    execute format('drop policy if exists vt_rh_update on public.%I', table_name);
    execute format(
      'create policy vt_rh_select on public.%I for select to authenticated using (public.journey_current_role() in (''ADMIN_RH'',''HR_MANAGER''))',
      table_name
    );
    execute format(
      'create policy vt_rh_insert on public.%I for insert to authenticated with check (public.journey_current_role() in (''ADMIN_RH'',''HR_MANAGER''))',
      table_name
    );
    execute format(
      'create policy vt_rh_update on public.%I for update to authenticated using (public.journey_current_role() in (''ADMIN_RH'',''HR_MANAGER'')) with check (public.journey_current_role() in (''ADMIN_RH'',''HR_MANAGER''))',
      table_name
    );
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vt_score_configs','vt_visits','vt_stage_entries','vt_interviews',
    'vt_interview_answers','vt_findings','vt_actions','vt_surveys'
  ] loop
    execute format('drop trigger if exists vt_set_updated_at on public.%I', table_name);
    execute format(
      'create trigger vt_set_updated_at before update on public.%I for each row execute function public.vt_touch_updated_at()',
      table_name
    );
  end loop;
end;
$$;

insert into public.vt_score_configs (name, weights, source_weights, health_bands, active)
values (
  'Padrão RH Journey v1',
  '{"abs":20,"leadership":20,"climate":15,"turnover":15,"people":10,"onboarding":8,"communication":5,"structure":5,"governance":2}'::jsonb,
  '{"objective":40,"perception":30,"observation":30}'::jsonb,
  '{"criticalMax":39.99,"highRiskMax":59.99,"attentionMax":74.99,"healthyMin":75}'::jsonb,
  true
)
on conflict (name) do update
set weights = excluded.weights,
    source_weights = excluded.source_weights,
    health_bands = excluded.health_bands,
    active = true,
    updated_at = now();

commit;

notify pgrst, 'reload schema';

