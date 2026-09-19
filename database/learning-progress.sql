-- Formal progress is separate from learning_progress_test. No user rows are migrated here.
begin;
create table public.learning_task_catalog (
 task_id text primary key, step_ids text[] not null check(cardinality(step_ids)>0)
);
alter table public.learning_task_catalog enable row level security;
revoke all on public.learning_task_catalog from anon, authenticated;
grant select on public.learning_task_catalog to authenticated;
create policy catalog_read on public.learning_task_catalog for select to authenticated using (true);
insert into public.learning_task_catalog(task_id,step_ids) values
('english-day-1-20', ARRAY['test']),
('english-day-21-28', ARRAY['test']),
('english-day-29', ARRAY['test']),
('english-day-30-31', ARRAY['test']),
('math-chapter1', ARRAY['study']),
('math-two-week-review', ARRAY['review','attempt','correction','retest']),
('math-chapter2-review', ARRAY['review']),
('math-chapter2-diagnostic', ARRAY['attempt','correction','retest']),
('math-monthly-targeted-01', ARRAY['attempt','correction','retest']),
('math-monthly-diagnostic', ARRAY['attempt','correction']),
('physics-chapter1-review', ARRAY['review']),
('physics-two-week-analysis', ARRAY['review','attempt','correction','retest']),
('physics-motion-0910', ARRAY['attempt','retest']),
('physics-chapter1-practice', ARRAY['attempt','correction','retest']),
('physics-chapter2-review', ARRAY['review']),
('physics-chapter2-practice', ARRAY['attempt','correction','retest']),
('chemistry-special-1', ARRAY['attempt','correction','retest']),
('chemistry-retest-1', ARRAY['retest']),
('math-chapter2-review-0919', ARRAY['review']),
('math-chapter2-practice-0919', ARRAY['attempt','correction']),
('math-chapter3-review-0919', ARRAY['review']),
('math-chapter3-retest-0919', ARRAY['attempt','correction']);
create table public.learning_progress (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 task_id text not null references public.learning_task_catalog(task_id),
 done text[] not null default '{}',
 bucket text not null default 'week' check(bucket in ('today','week','later','done')),
 version integer not null default 1,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,task_id)
);
create index learning_progress_task_idx on public.learning_progress(task_id);
alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from anon, authenticated;
grant select,insert,update on public.learning_progress to authenticated;
create policy progress_select on public.learning_progress for select to authenticated
 using ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy progress_insert on public.learning_progress for insert to authenticated
 with check ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy progress_update on public.learning_progress for update to authenticated
 using ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false')
 with check ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create or replace function private.stamp_learning_progress() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare allowed text[];
begin
 if TG_OP='UPDATE' and (new.user_id<>old.user_id or new.task_id<>old.task_id) then
  raise exception 'Progress identity cannot change' using errcode='23514';
 end if;
 select step_ids into allowed from public.learning_task_catalog where task_id=new.task_id;
 if allowed is null or array_position(new.done,null) is not null or not(new.done <@ allowed) then
  raise exception 'Unknown task or step' using errcode='23514';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}'::text[]) into new.done from unnest(new.done) x;
 new.updated_at=clock_timestamp();
 if TG_OP='INSERT' then new.version=1; else new.version=old.version+1; end if;
 if new.done @> allowed then
  new.bucket='done';
  if TG_OP='UPDATE' then new.completed_at=coalesce(old.completed_at,new.updated_at);
  else new.completed_at=new.updated_at; end if;
 else
  new.completed_at=null;
  if new.bucket='done' then new.bucket='week'; end if;
 end if;
 return new;
end; $$;
revoke all on function private.stamp_learning_progress() from public;
create trigger stamp_learning_progress before insert or update on public.learning_progress
 for each row execute function private.stamp_learning_progress();
commit;
