-- =====================================================================
-- k6 부하테스트 데이터 완전 삭제 (재생성 없음)
-- 예약 ID 대역(members 910001~920100, places 990001)만 정리한다. 실데이터 무관.
--
-- 사용법:
--   docker exec -i waggle-postgis psql -U waggle -d wagglewaggle < teardown.sql
-- =====================================================================

BEGIN;

-- FK 역순 삭제
DELETE FROM ai_chat_jobs      WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_warnings     WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_messages     WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_room_members WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_rooms        WHERE requester_id BETWEEN 910001 AND 920000;

DELETE FROM ai_blur_jobs        WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM pin_tags            WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM pin_evaluations     WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM pin_unlocks         WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM credit_transactions WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM view_transactions   WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 920100);
DELETE FROM pins                WHERE member_id BETWEEN 910001 AND 920100;

DELETE FROM credit_transactions  WHERE member_id BETWEEN 910001 AND 920100;
DELETE FROM view_transactions    WHERE member_id BETWEEN 910001 AND 920100;
DELETE FROM search_histories     WHERE member_id BETWEEN 910001 AND 920100;
DELETE FROM category_preferences WHERE member_id BETWEEN 910001 AND 920100;
DELETE FROM refresh_tokens       WHERE member_id BETWEEN 910001 AND 920100;
UPDATE social_accounts SET member_id = NULL WHERE member_id BETWEEN 910001 AND 920100;
DELETE FROM members              WHERE id BETWEEN 910001 AND 920100;
DELETE FROM places               WHERE id = 990001;

COMMIT;

SELECT
  (SELECT count(*) FROM members WHERE id BETWEEN 910001 AND 920100) AS remaining_members,
  (SELECT count(*) FROM pins WHERE member_id BETWEEN 910001 AND 920100) AS remaining_pins,
  (SELECT count(*) FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000) AS remaining_chat_rooms;
