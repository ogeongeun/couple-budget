-- 임시 테스트 도구: 현재 커플 보관함에 활성 아이템을 모두 지급한다.
-- 착용 이미지 검수가 끝나면 rewards 페이지의 RPC 호출과 함께 제거할 수 있다.
create or replace function public.grant_all_reward_items_for_testing()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  current_user_id uuid := auth.uid();
  current_couple_id uuid;
  granted_count integer;
begin
  if current_user_id is null then
    raise exception '로그인이 필요해요.';
  end if;

  select couple_id into current_couple_id
  from profiles
  where id=current_user_id;

  if current_couple_id is null then
    raise exception '커플 연결이 필요해요.';
  end if;

  insert into user_inventory(couple_id,item_id,drawn_by)
  select current_couple_id,id,current_user_id
  from reward_items
  where is_active
  on conflict(couple_id,item_id) do nothing;

  get diagnostics granted_count = row_count;
  return granted_count;
end;
$$;

revoke all on function public.grant_all_reward_items_for_testing() from public;
grant execute on function public.grant_all_reward_items_for_testing() to authenticated;
