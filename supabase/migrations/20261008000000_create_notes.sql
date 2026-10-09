create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 100000),
  color text not null default 'default'
    check (color in ('default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink')),
  pinned boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create index notes_user_server_updated_at_idx on public.notes (user_id, server_updated_at);

alter table public.notes enable row level security;

create policy "Users read own notes" on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own notes" on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own notes" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger notes_set_server_updated_at
  before insert or update on public.notes
  for each row execute function public.set_server_updated_at();

create function public.push_notes(payload jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.notes (id, user_id, content, color, pinned, created_at, updated_at, deleted_at)
  select n.id, auth.uid(), n.content, n.color, n.pinned, n.created_at, n.updated_at, n.deleted_at
  from jsonb_to_recordset(payload) as n (
    id uuid,
    content text,
    color text,
    pinned boolean,
    created_at timestamptz,
    updated_at timestamptz,
    deleted_at timestamptz
  )
  on conflict (id) do update set
    content = excluded.content,
    color = excluded.color,
    pinned = excluded.pinned,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at
  where public.notes.updated_at < excluded.updated_at;
$$;

revoke execute on function public.push_notes(jsonb) from public, anon;
grant execute on function public.push_notes(jsonb) to authenticated;

alter publication supabase_realtime add table public.notes;
