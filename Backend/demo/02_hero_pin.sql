-- [DEMO] 시연 당일: 직접 촬영한 히어로 핀(예: 스타벅스, 하루 전 업로드)을 지금 노출시키기.
-- 하루 전 올린 핀은 created_at·expires_at 이 과거라 지도 1시간 창/만료 조건에 걸려 안 보인다.
-- created_at=now(), expires_at=now()+1h 로 밀어 "방금 등록"처럼 되살린다. (원본 1h 로직 기준)
-- 원본 데이터 위험 없음: 좌표·영상키·소유자는 그대로 두고 시각 2개만 바꾼다. (재실행 안전)
--
-- 사용법: [1단계]로 대상 핀 id 확인 → [2단계] UPDATE 의 id 채워 실행.

-- ================= [1단계] 대상 핀 찾기 =================
-- 최근 올라온 실제(비데모) 핀 목록. video_status='ACTIVE' + has_video=true 여야 상세 재생이 된다.
-- 스타벅스 핀을 이름/시각으로 찾아 id 를 복사한다.
SELECT pin.id,
       pl.name,
       pin.video_status,
       pin.created_at,
       pin.expires_at,
       (pin.blurred_video_key IS NOT NULL) AS has_video
FROM pins pin
JOIN places pl ON pl.id = pin.place_id
WHERE pin.original_video_key NOT LIKE 'demo/%'
ORDER BY pin.created_at DESC
LIMIT 20;

-- ================= [2단계] 히어로 핀 되살리기 =================
-- 위에서 고른 id 를 넣고 아래 주석을 해제해 실행 (여러 개면 콤마로 나열).
-- UPDATE pins
-- SET created_at = now(),
--     expires_at = now() + interval '1 hour'
-- WHERE id IN ('여기에-스타벅스-핀-id');
