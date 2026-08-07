-- [DEMO] 시연 중 "직접 촬영한" 히어로 핀들의 만료를 7일로 연장한다.
-- 앱으로 촬영·등록하면 활성화 시 expires_at = 활성화시각 + 1시간이라 곧 사라지므로,
-- 촬영을 마친 직후 이 스크립트를 한 번 돌려 7일로 밀어준다. (엔티티 TTL 상수는 건드리지 않음)
--
-- 대상: 최근 2시간 내 등록된 ACTIVE·미삭제 핀 중 데모 INSERT 핀(demo/%)이 아닌 것 = 방금 직접 찍은 핀.
--       팀 외 다른 사용자 핀까지 잡히는 게 걱정되면 아래 member_id 조건 주석을 해제해 본인 것만 대상으로.
-- 재실행 안전(멱등): 여러 번 돌려도 항상 now()+7d 로 재설정될 뿐.

BEGIN;

UPDATE pins
SET expires_at = now() + interval '7 days'
WHERE video_status = 'ACTIVE'
  AND deleted_at IS NULL
  AND original_video_key NOT LIKE 'demo/%'
  AND created_at >= now() - interval '2 hours'
  -- AND member_id = <본인 member_id>   -- 필요 시 주석 해제
;

-- 무엇이 연장됐는지 확인
SELECT pin.id,
       pl.name,
       pin.crowd_level,
       pin.expires_at,
       pin.created_at
FROM pins pin
JOIN places pl ON pl.id = pin.place_id
WHERE pin.video_status = 'ACTIVE'
  AND pin.deleted_at IS NULL
  AND pin.original_video_key NOT LIKE 'demo/%'
  AND pin.created_at >= now() - interval '2 hours'
ORDER BY pin.created_at DESC;

COMMIT;
