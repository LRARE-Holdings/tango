-- Stack delivery flow for sending full stacks or selected documents.
-- Rollback notes: drop child tables in reverse dependency order:
-- stack_acknowledgement_receipts -> stack_document_acknowledgements ->
-- stack_delivery_recipients -> stack_delivery_documents -> stack_deliveries.

create table if not exists public.stack_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stack_id uuid references public.receipt_stacks(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  public_id text not null unique,
  status text not null default 'active' check (status in ('active','completed','expired','revoked')),
  settings jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stack_delivery_documents (
  delivery_id uuid not null references public.stack_deliveries(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  position integer not null default 0,
  required boolean not null default true,
  primary key (delivery_id, document_id)
);

create unique index if not exists stack_delivery_documents_delivery_position_uidx
  on public.stack_delivery_documents (delivery_id, position);

create table if not exists public.stack_delivery_recipients (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.stack_deliveries(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz,
  completed_at timestamptz,
  unique (delivery_id, recipient_email)
);

create table if not exists public.stack_document_acknowledgements (
  delivery_recipient_id uuid not null references public.stack_delivery_recipients(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  completion_id uuid references public.completions(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  ack_method text not null default 'public_link',
  metadata jsonb not null default '{}'::jsonb,
  primary key (delivery_recipient_id, document_id)
);

create table if not exists public.stack_acknowledgement_receipts (
  id uuid primary key default gen_random_uuid(),
  delivery_recipient_id uuid not null references public.stack_delivery_recipients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stack_id uuid references public.receipt_stacks(id) on delete set null,
  delivery_id uuid not null references public.stack_deliveries(id) on delete cascade,
  completed_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  outstanding_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (delivery_recipient_id, delivery_id)
);

create index if not exists stack_deliveries_workspace_created_idx
  on public.stack_deliveries (workspace_id, created_at desc);

create index if not exists stack_deliveries_public_id_idx
  on public.stack_deliveries (public_id);

create index if not exists stack_delivery_recipients_delivery_idx
  on public.stack_delivery_recipients (delivery_id);

create index if not exists stack_delivery_recipients_email_idx
  on public.stack_delivery_recipients (recipient_email);

create index if not exists stack_document_ack_delivery_recipient_idx
  on public.stack_document_acknowledgements (delivery_recipient_id, acknowledged_at desc);

create index if not exists stack_ack_receipts_delivery_idx
  on public.stack_acknowledgement_receipts (delivery_id, completed_at desc);

alter table public.stack_deliveries enable row level security;
alter table public.stack_delivery_documents enable row level security;
alter table public.stack_delivery_recipients enable row level security;
alter table public.stack_document_acknowledgements enable row level security;
alter table public.stack_acknowledgement_receipts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_deliveries' and policyname = 'stack_deliveries_member_select'
  ) then
    create policy stack_deliveries_member_select
      on public.stack_deliveries
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = stack_deliveries.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_deliveries' and policyname = 'stack_deliveries_member_insert'
  ) then
    create policy stack_deliveries_member_insert
      on public.stack_deliveries
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = stack_deliveries.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_deliveries' and policyname = 'stack_deliveries_creator_update'
  ) then
    create policy stack_deliveries_creator_update
      on public.stack_deliveries
      for update
      to authenticated
      using (created_by = auth.uid())
      with check (created_by = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_delivery_documents' and policyname = 'stack_delivery_documents_member_all'
  ) then
    create policy stack_delivery_documents_member_all
      on public.stack_delivery_documents
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.stack_deliveries sd
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sd.id = stack_delivery_documents.delivery_id
        )
      )
      with check (
        exists (
          select 1
          from public.stack_deliveries sd
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sd.id = stack_delivery_documents.delivery_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_delivery_recipients' and policyname = 'stack_delivery_recipients_member_select'
  ) then
    create policy stack_delivery_recipients_member_select
      on public.stack_delivery_recipients
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.stack_deliveries sd
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sd.id = stack_delivery_recipients.delivery_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_delivery_recipients' and policyname = 'stack_delivery_recipients_member_manage'
  ) then
    create policy stack_delivery_recipients_member_manage
      on public.stack_delivery_recipients
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.stack_deliveries sd
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sd.id = stack_delivery_recipients.delivery_id
        )
      )
      with check (
        exists (
          select 1
          from public.stack_deliveries sd
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sd.id = stack_delivery_recipients.delivery_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_document_acknowledgements' and policyname = 'stack_document_acknowledgements_member_select'
  ) then
    create policy stack_document_acknowledgements_member_select
      on public.stack_document_acknowledgements
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.stack_delivery_recipients sdr
          join public.stack_deliveries sd on sd.id = sdr.delivery_id
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sdr.id = stack_document_acknowledgements.delivery_recipient_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_document_acknowledgements' and policyname = 'stack_document_acknowledgements_member_manage'
  ) then
    create policy stack_document_acknowledgements_member_manage
      on public.stack_document_acknowledgements
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.stack_delivery_recipients sdr
          join public.stack_deliveries sd on sd.id = sdr.delivery_id
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sdr.id = stack_document_acknowledgements.delivery_recipient_id
        )
      )
      with check (
        exists (
          select 1
          from public.stack_delivery_recipients sdr
          join public.stack_deliveries sd on sd.id = sdr.delivery_id
          join public.workspace_members wm on wm.workspace_id = sd.workspace_id and wm.user_id = auth.uid()
          where sdr.id = stack_document_acknowledgements.delivery_recipient_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_acknowledgement_receipts' and policyname = 'stack_acknowledgement_receipts_member_select'
  ) then
    create policy stack_acknowledgement_receipts_member_select
      on public.stack_acknowledgement_receipts
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = stack_acknowledgement_receipts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stack_acknowledgement_receipts' and policyname = 'stack_acknowledgement_receipts_member_insert'
  ) then
    create policy stack_acknowledgement_receipts_member_insert
      on public.stack_acknowledgement_receipts
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = stack_acknowledgement_receipts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end $$;
