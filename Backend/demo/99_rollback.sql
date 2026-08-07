-- [DEMO] 시연 데이터 원복. 데모 핀(+그 자식 행들)과, "데모가 새로 만든" 장소만 삭제한다.
-- 핀 식별: original_video_key LIKE 'demo/%'
-- 장소 식별: 아래 15개 kakao_place_id 중, (a) 데모 세팅 시점 이후 생성됐고(created_at) (b) 참조 핀이 없는 고아 행만.
--          → 기존에 실제로 있던(재사용된) 장소나, 다른 실제 핀이 붙은 장소는 절대 지우지 않는다.
-- 주의: 세팅을 다른 날 했다면 아래 SETUP_DATE 를 세팅한 날짜로 맞출 것.
-- 시연 중 데모 핀에 잠금해제/평가/채팅 등이 붙을 수 있어, pins 를 지우기 전에 자식 테이블을 먼저 지운다.

BEGIN;

-- 삭제 대상 집합을 먼저 확정
CREATE TEMP TABLE _demo_pins ON COMMIT DROP AS
    SELECT id FROM pins WHERE original_video_key LIKE 'demo/%';
CREATE TEMP TABLE _demo_rooms ON COMMIT DROP AS
    SELECT id FROM chat_rooms WHERE pin_id IN (SELECT id FROM _demo_pins);

-- 1) 채팅방 하위
DELETE FROM chat_messages     WHERE chat_room_id IN (SELECT id FROM _demo_rooms);
DELETE FROM chat_warnings     WHERE chat_room_id IN (SELECT id FROM _demo_rooms);
DELETE FROM ai_chat_jobs      WHERE chat_room_id IN (SELECT id FROM _demo_rooms);
DELETE FROM chat_room_members WHERE chat_room_id IN (SELECT id FROM _demo_rooms);
DELETE FROM chat_rooms        WHERE id           IN (SELECT id FROM _demo_rooms);

-- 2) 핀 자식
DELETE FROM pin_unlocks         WHERE pin_id IN (SELECT id FROM _demo_pins);
DELETE FROM pin_evaluations     WHERE pin_id IN (SELECT id FROM _demo_pins);
DELETE FROM pin_tags            WHERE pin_id IN (SELECT id FROM _demo_pins);
DELETE FROM credit_transactions WHERE pin_id IN (SELECT id FROM _demo_pins);
DELETE FROM view_transactions   WHERE pin_id IN (SELECT id FROM _demo_pins);
DELETE FROM ai_blur_jobs        WHERE pin_id IN (SELECT id FROM _demo_pins);

-- 3) 데모 핀
DELETE FROM pins WHERE id IN (SELECT id FROM _demo_pins);

-- 4) 데모가 새로 만든(고아가 된) 장소만
DELETE FROM places
WHERE kakao_place_id IN (
        '327148272','21960500','170118016','2142723351','2044587542',
        '1050527540','1749534812','27440874','8144397','8095238',
        '26576845','1353935275','25968685','11831489','8652100')
  AND created_at >= DATE '2026-08-07'   -- SETUP_DATE: 세팅한 날짜 이후 생성된 것만 (재사용된 기존 장소 보호)
  AND NOT EXISTS (SELECT 1 FROM pins p WHERE p.place_id = places.id);

COMMIT;
