-- 홈에서는 밥그릇과 저금통의 기본 이미지만 사용한다.
-- 기존 보유 내역은 보존하지만 보물상자와 뽑기에서는 제외한다.
update public.reward_items
set is_active = false
where category in ('bowl', 'piggy_bank');

delete from public.equipped_reward_items
where category in ('bowl', 'piggy_bank');
