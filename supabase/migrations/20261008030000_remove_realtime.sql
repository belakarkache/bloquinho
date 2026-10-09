drop policy "Users receive own note changes" on realtime.messages;

drop function public.push_notes(jsonb, text);

create function public.push_notes(payload jsonb)
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
end;
$$;

revoke execute on function public.push_notes(jsonb) from public, anon;
grant execute on function public.push_notes(jsonb) to authenticated;
