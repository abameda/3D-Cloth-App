create schema if not exists thread_private;
revoke all on schema thread_private from public,anon;
grant usage on schema thread_private to authenticated,service_role;
create function thread_private.active_session() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=(select auth.uid()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and s.id::text=(select auth.jwt()->>'session_id') and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function thread_private.active_session() from public,anon;
grant execute on function thread_private.active_session() to authenticated,service_role;
create table public.wardrobe_snapshots(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0 check(revision>=0),object_key text,updated_at timestamptz not null default now());
alter table public.wardrobe_snapshots enable row level security;
revoke all on public.wardrobe_snapshots from anon,authenticated;
grant select on public.wardrobe_snapshots to authenticated;
grant all on public.wardrobe_snapshots to service_role;
create policy read_own_snapshot on public.wardrobe_snapshots for select to authenticated using(user_id=(select auth.uid()) and (select thread_private.active_session()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('thread-vaults','thread-vaults',false,48234496,array['application/json','application/octet-stream']);
create policy read_own_vault on storage.objects for select to authenticated using(bucket_id='thread-vaults' and (storage.foldername(name))[1]=(select auth.uid()::text) and (select thread_private.active_session()));
create policy insert_own_vault on storage.objects for insert to authenticated with check(bucket_id='thread-vaults' and (storage.foldername(name))[1]=(select auth.uid()::text) and name ~ '^[0-9a-f-]{36}/([0-9a-f-]{36}\.json|assets/[0-9a-f]{64}\.bin)$' and (select thread_private.active_session()));
create policy remove_own_vault on storage.objects for delete to authenticated using(bucket_id='thread-vaults' and (storage.foldername(name))[1]=(select auth.uid()::text) and (select thread_private.active_session()));
create function thread_private.commit_snapshot(expected_revision bigint,next_key text)returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_row public.wardrobe_snapshots;
begin
 if uid is null or not thread_private.active_session() then raise exception 'Active session required' using errcode='28000';end if;
 if expected_revision is null or expected_revision<0 or next_key is null or split_part(next_key,'/',1)<>uid::text or next_key!~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.json$' then raise exception 'Invalid snapshot request' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='thread-vaults' and name=next_key)then raise exception 'Upload is missing' using errcode='22023';end if;
 insert into public.wardrobe_snapshots(user_id)values(uid)on conflict do nothing;
 select * into current_row from public.wardrobe_snapshots where user_id=uid for update;
 if current_row.revision<>expected_revision then raise exception 'Snapshot conflict' using errcode='40001';end if;
 update public.wardrobe_snapshots set revision=revision+1,object_key=next_key,updated_at=now()where user_id=uid returning * into current_row;
 return jsonb_build_object('revision',current_row.revision,'object_key',current_row.object_key,'updated_at',current_row.updated_at);
end;$$;
revoke all on function thread_private.commit_snapshot(bigint,text)from public,anon;
grant execute on function thread_private.commit_snapshot(bigint,text)to authenticated;
create function public.commit_wardrobe_snapshot(expected_revision bigint,next_key text)returns jsonb language sql security invoker set search_path='' as $$ select thread_private.commit_snapshot(expected_revision,next_key); $$;
revoke all on function public.commit_wardrobe_snapshot(bigint,text)from public,anon;
grant execute on function public.commit_wardrobe_snapshot(bigint,text)to authenticated;

