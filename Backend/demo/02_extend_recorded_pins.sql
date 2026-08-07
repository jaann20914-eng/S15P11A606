-- [DEMO] 시연 중 "직접 촬영한" 히어로 핀을 방금 등록한 것처럼 되살린다(원본 1시간 로직 기준).
-- 서버는 원본 로직으로 돌아온 상태 → 촬영한 핀은 활성화 시각 기준 약 1시간만 노출된다.
-- 촬영이 조금 전이라 지도 "최근 1시간 창"에서 밀려났거나 만료가 임박하면, 이걸 돌려
-- created_at·expires_at 을 지금 기준으로 리셋해 다시 신선하게 노출시킨다. (재실행 안전)
-- 대상: 최근 2시간 내 등록된 ACTIVE·미삭제·비데모 핀 = 방금 직접 찍은 핀.
--       팀 외 다른 사용자 핀까지 잡히는 게 걱정되면 아래 member_id 조건 주석을 해제해 본인 것만 대상으로.

BEGIN;

UPDATE pins
SET created_at = now(),                        -- 지도 최근 1시간 창에 다시 들어오게
    expires_at = now() + interval '1 hour'     -- 원본 TTL과 동일(활성화시각 ≈ now)
WHERE video_status = 'ACTIVE'
  AND deleted_at IS NULL
  AND original_video_key NOT LIKE 'demo/%'
  AND created_at >= now() - interval '2 hours'
  -- AND member_id = <본인 member_id>   -- 필요 시 주석 해제
;

-- 무엇이 리셋됐는지 확인
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
  AND pin.created_at >= now() - interval '5 minutes'
ORDER BY pin.created_at DESC;

COMMIT;
