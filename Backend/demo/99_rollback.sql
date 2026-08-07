-- [DEMO] 시연 데이터 원복. 데모 핀·장소만 삭제한다(원본 데이터는 애초에 안 건드렸음).
-- 데모 핀은 방금 INSERT 한 새 행이라 pin_tags/pin_unlocks/pin_evaluations/chat_rooms 자식이 없어
-- 그대로 삭제 가능하다. 혹시 시연 중 평가/채팅 등이 붙었다면 아래 자식 삭제 주석을 해제할 것.

BEGIN;

-- (안전장치) 데모 핀에 자식이 생겼을 경우를 대비한 선삭제 — 필요 시 주석 해제
-- DELETE FROM pin_evaluations WHERE pin_id IN (SELECT id FROM pins WHERE original_video_key LIKE 'demo/%');
-- DELETE FROM pin_tags        WHERE pin_id IN (SELECT id FROM pins WHERE original_video_key LIKE 'demo/%');
-- DELETE FROM pin_unlocks     WHERE pin_id IN (SELECT id FROM pins WHERE original_video_key LIKE 'demo/%');

DELETE FROM pins   WHERE original_video_key LIKE 'demo/%';
DELETE FROM places WHERE kakao_place_id LIKE 'DEMO_%';

COMMIT;
