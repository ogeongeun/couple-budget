-- 테스트 종료: 현재 로그인한 사용자의 커플 보관함만 초기화할 수 있다.
create or replace function public.reset_my_couple_reward_inventory()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  current_couple_id uuid;
begin
  select couple_id into current_couple_id
  from profiles
  where id=auth.uid();

  if current_couple_id is null then
    raise exception '커플 연결이 필요해요.';
  end if;

  delete from equipped_reward_items
  where couple_id=current_couple_id;

  delete from user_inventory
  where couple_id=current_couple_id;
end;
$$;

revoke all on function public.reset_my_couple_reward_inventory() from public;
grant execute on function public.reset_my_couple_reward_inventory() to authenticated;

-- 테스트용 전체 지급 함수는 더 이상 실행할 수 없게 제거한다.
drop function if exists public.grant_all_reward_items_for_testing();
