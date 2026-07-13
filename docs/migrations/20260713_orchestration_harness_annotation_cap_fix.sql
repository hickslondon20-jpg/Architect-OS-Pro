-- Correct the annotation cap for multi-row inserts as well as normal single-row tool writes.
create or replace function public.cap_agent_annotations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update public.agent_annotations
       set status = 'cleared', updated_at = now()
     where user_id = new.user_id
       and resource_kind = new.resource_kind
       and resource_ref = new.resource_ref
       and status = 'active'
       and id not in (
         select keep.id
           from public.agent_annotations keep
          where keep.user_id = new.user_id
            and keep.resource_kind = new.resource_kind
            and keep.resource_ref = new.resource_ref
            and keep.status = 'active'
          order by keep.created_at desc, keep.id desc
          limit 8
       );
  end if;
  return new;
end;
$$;

