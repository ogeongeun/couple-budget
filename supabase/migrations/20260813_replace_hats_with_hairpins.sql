-- 머리 모양을 가리는 모자 대신 원본 위에 얹는 머리핀으로 교체한다.
update public.reward_items set name='빨강 리본핀' where sprite_index=0 and category='hat';
update public.reward_items set name='노랑 리본핀' where sprite_index=1 and category='hat';
update public.reward_items set name='분홍 리본핀' where sprite_index=2 and category='hat';
update public.reward_items set name='하늘 리본핀' where sprite_index=3 and category='hat';
