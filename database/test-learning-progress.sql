begin;
insert into auth.users(id,aud,role) values
('10000000-0000-4000-8000-000000000001','authenticated','authenticated'),
('10000000-0000-4000-8000-000000000002','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
insert into public.learning_progress(task_id,done,bucket) values ('math-chapter2-review-0919',array['review'],'week');
do $$ begin
 if not exists(select 1 from public.learning_progress where task_id='math-chapter2-review-0919' and version=1 and bucket='done' and completed_at is not null) then raise exception 'completion failed'; end if;
 update public.learning_progress set done='{}' where task_id='math-chapter2-review-0919' and version=1;
 if not exists(select 1 from public.learning_progress where task_id='math-chapter2-review-0919' and version=2 and bucket='week' and completed_at is null) then raise exception 'reopen failed'; end if;
 update public.learning_progress set done=array['review'] where task_id='math-chapter2-review-0919' and version=1;
 if found then raise exception 'stale version overwrote data'; end if;
 begin
  update public.learning_progress set done=array['fake-step'] where task_id='math-chapter2-review-0919';
  raise exception 'invalid step accepted';
 exception when check_violation then null; end;
 begin
  insert into public.learning_progress(user_id,task_id) values ('10000000-0000-4000-8000-000000000002','math-chapter2-review-0919');
  raise exception 'cross-user insert accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
do $$ begin
 if exists(select 1 from public.learning_progress) then raise exception 'cross-user read leaked'; end if;
 update public.learning_progress set done=array['review'] where user_id='10000000-0000-4000-8000-000000000001';
 if found then raise exception 'cross-user update accepted'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 if exists(select 1 from public.learning_progress) then raise exception 'anonymous auth read leaked'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.learning_progress; raise exception 'anon read accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: own read/write, completion, reopen, stale update, invalid step, cross-user read/write and anonymous denial; all fixtures rolled back' as result;
