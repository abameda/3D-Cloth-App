begin;
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid(); ka text; kb text; result jsonb; count_rows int;
begin
 insert into auth.users(id)values(a),(b);
 insert into auth.sessions(id,user_id)values(sa,a),(sb,b);
 ka:=a::text||'/'||gen_random_uuid()::text||'.json';kb:=b::text||'/'||gen_random_uuid()::text||'.json';
 insert into storage.objects(bucket_id,name,owner_id)values('thread-vaults',ka,a::text),('thread-vaults',kb,b::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sa)::text,true);
 set local role authenticated;
 if not thread_private.active_session()then raise exception 'active session test failed';end if;
 select count(*)into count_rows from storage.objects where bucket_id='thread-vaults';if count_rows<>1 then raise exception 'storage isolation failed';end if;
 result:=public.commit_wardrobe_snapshot(0,ka);if (result->>'revision')::int<>1 then raise exception 'first commit failed';end if;
 begin perform public.commit_wardrobe_snapshot(0,ka);raise exception 'stale revision accepted';exception when serialization_failure then null;end;
 begin perform public.commit_wardrobe_snapshot(null,ka);raise exception 'null revision accepted';exception when invalid_parameter_value then null;end;
 begin perform public.commit_wardrobe_snapshot(1,kb);raise exception 'cross owner key accepted';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','session_id',sb)::text,true);
 select count(*)into count_rows from public.wardrobe_snapshots;if count_rows<>0 then raise exception 'snapshot isolation failed';end if;
 result:=public.commit_wardrobe_snapshot(0,kb);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',gen_random_uuid())::text,true);
 select count(*)into count_rows from storage.objects where bucket_id='thread-vaults';if count_rows<>0 then raise exception 'revoked session storage access';end if;
 begin perform public.commit_wardrobe_snapshot(1,ka);raise exception 'revoked session commit accepted';exception when invalid_authorization_specification then null;end;
 reset role;
end;$test$;
select 'passed: private storage, owner isolation, first commit, stale revision, null revision, cross-owner key, revoked session' as checks;
rollback;
