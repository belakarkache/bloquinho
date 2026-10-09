create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (user_id, action)
);

revoke all on table private.rate_limits from public, anon, authenticated;

create function private.consume_rate_limit(action_name text, max_hits_per_minute integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  used integer;
begin
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (auth.uid(), action_name, current_window, 1)
  on conflict (user_id, action) do update set
    hits = case when r.window_start = current_window then r.hits + 1 else 1 end,
    window_start = current_window
  returning r.hits into used;

  if used > max_hits_per_minute then
    raise exception 'rate limit exceeded for %', action_name using errcode = 'PT429';
  end if;
end;
$$;

create function private.note_usage(owner uuid, out live_notes bigint, out total_rows bigint, out live_bytes bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*) filter (where deleted_at is null),
    count(*),
    coalesce(sum(octet_length(content)) filter (where deleted_at is null), 0)
  from public.notes
  where user_id = owner;
$$;

revoke all on function private.consume_rate_limit(text, integer) from public, anon, authenticated;
revoke all on function private.note_usage(uuid) from public, anon, authenticated;

alter table public.notes drop constraint notes_content_check;
alter table public.notes add constraint notes_content_check check (char_length(content) <= 20000) not valid;

drop policy "Users read own notes" on public.notes;
drop policy "Users insert own notes" on public.notes;
drop policy "Users update own notes" on public.notes;
revoke all on table public.notes from anon, authenticated;

alter publication supabase_realtime drop table public.notes;

drop function public.push_notes(jsonb);

create function public.push_notes(payload jsonb, device_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  usage_before record;
  usage_after record;
  changed integer;
begin
  if owner is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) > 200 then
    raise exception 'payload must be an array with at most 200 notes' using errcode = 'PT413';
  end if;

  perform private.consume_rate_limit('push', 20);

  delete from public.notes
  where user_id = owner and deleted_at < now() - interval '30 days';

  select * into usage_before from private.note_usage(owner);

  insert into public.notes (id, user_id, content, color, pinned, created_at, updated_at, deleted_at)
  select
    n.id,
    owner,
    case when n.deleted_at is null then n.content else '' end,
    n.color,
    n.pinned,
    n.created_at,
    n.updated_at,
    n.deleted_at
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
  where public.notes.user_id = owner and public.notes.updated_at < excluded.updated_at;

  get diagnostics changed = row_count;
  if changed = 0 then
    return;
  end if;

  select * into usage_after from private.note_usage(owner);
  if (usage_after.live_notes > 2000 and usage_after.live_notes > usage_before.live_notes)
    or (usage_after.total_rows > 3000 and usage_after.total_rows > usage_before.total_rows)
    or (usage_after.live_bytes > 5242880 and usage_after.live_bytes > usage_before.live_bytes) then
    raise exception 'storage quota exceeded' using errcode = 'PT413';
  end if;

  perform realtime.send(
    jsonb_build_object('device', left(device_id, 64)),
    'changed',
    'notes:' || owner::text,
    true
  );
end;
$$;

create function public.pull_notes(since timestamptz default null, page_size integer default 500)
returns table (
  id uuid,
  content text,
  color text,
  pinned boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  server_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform private.consume_rate_limit('pull', 30);

  return query
    select n.id, n.content, n.color, n.pinned, n.created_at, n.updated_at, n.deleted_at, n.server_updated_at
    from public.notes as n
    where n.user_id = auth.uid() and (since is null or n.server_updated_at > since)
    order by n.server_updated_at
    limit least(greatest(page_size, 1), 500);
end;
$$;

revoke execute on function public.push_notes(jsonb, text) from public, anon;
revoke execute on function public.pull_notes(timestamptz, integer) from public, anon;
grant execute on function public.push_notes(jsonb, text) to authenticated;
grant execute on function public.pull_notes(timestamptz, integer) to authenticated;

create policy "Users receive own note changes" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) = 'notes:' || (select auth.uid())::text
    and realtime.messages.extension = 'broadcast'
  );
