-- Additive schema for drafts, immutable first submissions and private answer photos.
begin;
create table public.learning_answer_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 document_id text not null check(length(document_id) between 1 and 180),
 document_version text not null check(length(document_version) between 1 and 80),
 draft jsonb not null default '{}' check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=1048576),
 corrections jsonb not null default '{}' check(jsonb_typeof(corrections)='object' and octet_length(corrections::text)<=1048576),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=100),
 phase text not null default 'draft' check(phase in ('draft','submitted')),
 first_submission jsonb,
 submitted_at timestamptz,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index answer_attempts_owner_document_created on public.learning_answer_attempts(user_id,document_id,document_version,created_at desc);
alter table public.learning_answer_attempts enable row level security;
revoke all on public.learning_answer_attempts from anon,authenticated;
grant select,insert,update on public.learning_answer_attempts to authenticated;
create policy answers_read on public.learning_answer_attempts for select to authenticated
 using ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy answers_insert on public.learning_answer_attempts for insert to authenticated
 with check ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create policy answers_update on public.learning_answer_attempts for update to authenticated
 using ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false')
 with check ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create or replace function private.stamp_answer_attempt() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.user_id<>old.user_id or new.document_id<>old.document_id or new.document_version<>old.document_version then
   raise exception 'Answer identity cannot change' using errcode='23514';
  end if;
  new.created_at=old.created_at;
  new.version=old.version+1;
  if old.phase='submitted' then
   if new.phase<>'submitted' or new.first_submission is distinct from old.first_submission or new.submitted_at is distinct from old.submitted_at then
    raise exception 'First submission is immutable; create another attempt to retry' using errcode='23514';
   end if;
  end if;
 else
  new.version=1;new.created_at=clock_timestamp();new.first_submission=null;new.submitted_at=null;
 end if;
 for item in select value from jsonb_array_elements(new.attachments) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'path','') not like new.user_id::text||'/'||new.id::text||'/%' then
   raise exception 'Attachment must belong to this user and attempt' using errcode='23514';
  end if;
 end loop;
 new.updated_at=clock_timestamp();
 if new.phase='submitted' and (TG_OP='INSERT' or old.phase='draft') then
  new.first_submission=jsonb_build_object('draft',new.draft,'attachments',new.attachments);
  new.submitted_at=new.updated_at;
 elsif new.phase='draft' then
  new.first_submission=null;new.submitted_at=null;
 end if;
 return new;
end; $$;
revoke all on function private.stamp_answer_attempt() from public;
create trigger stamp_answer_attempt before insert or update on public.learning_answer_attempts
 for each row execute function private.stamp_answer_attempt();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('learning-answer-photos','learning-answer-photos',false,8388608,ARRAY['image/jpeg','image/png','image/webp']);
create policy answer_photos_read on storage.objects for select to authenticated using (
 bucket_id='learning-answer-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
);
create policy answer_photos_insert on storage.objects for insert to authenticated with check (
 bucket_id='learning-answer-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.learning_answer_attempts a where a.user_id=(select auth.uid()) and a.id::text=(storage.foldername(name))[2])
);
-- No UPDATE/DELETE policy on photos: a submitted image cannot be silently replaced.
comment on table public.learning_answer_attempts is 'Owner-only drafts and corrections; first_submission stamped once by server. Update using id AND version for optimistic concurrency.';
commit;
