-- =====================================================================
-- k6 부하테스트 시드 데이터 (재실행 가능 / 기존 부하테스트 데이터는 매번 정리 후 재생성)
--
-- 사용법:
--   psql "$DATABASE_URL" -v n=100 -f seed.sql      (n = 테스트 계정 쌍 수, 기본 100)
--
-- 예약 ID 대역 (실데이터와 절대 겹치지 않도록 크게 잡음):
--   members  910001 ~ 910000+n : 채팅 요청자(requester) 계정
--   members  920001 ~ 920000+n : 핀 작성자(owner) 계정
--   places   990001            : 부하테스트 전용 장소 (충북 산간 좌표)
--
-- 주의: 반드시 부하테스트 전용 DB에서 실행할 것.
-- =====================================================================

\if :{?n}
\else
\set n 100
\endif

BEGIN;

-- ---------- 1. 기존 부하테스트 데이터 정리 (FK 역순) ----------
DELETE FROM ai_chat_jobs      WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_warnings     WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_messages     WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_room_members WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000);
DELETE FROM chat_rooms        WHERE requester_id BETWEEN 910001 AND 920000;

DELETE FROM ai_blur_jobs        WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM pin_tags            WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM pin_evaluations     WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM pin_unlocks         WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM credit_transactions WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM view_transactions   WHERE pin_id IN (SELECT id FROM pins WHERE member_id BETWEEN 910001 AND 930000);
DELETE FROM pins                WHERE member_id BETWEEN 910001 AND 930000;

DELETE FROM credit_transactions  WHERE member_id BETWEEN 910001 AND 930000;
DELETE FROM view_transactions    WHERE member_id BETWEEN 910001 AND 930000;
DELETE FROM search_histories     WHERE member_id BETWEEN 910001 AND 930000;
DELETE FROM category_preferences WHERE member_id BETWEEN 910001 AND 930000;
DELETE FROM refresh_tokens       WHERE member_id BETWEEN 910001 AND 930000;
UPDATE social_accounts SET member_id = NULL WHERE member_id BETWEEN 910001 AND 930000;
DELETE FROM members              WHERE id BETWEEN 910001 AND 930000;
DELETE FROM places               WHERE id = 990001;

-- ---------- 2. 테스트 회원 ----------
-- 요청자 (nickname: ltreq1 ~) — credit 넉넉히 (unlock/chat 크레딧 차감 방지)
INSERT INTO members (id, nickname, age_group, gender, view_angle, credit_balance, created_at, updated_at)
SELECT 910000 + i, 'ltreq' || i, 'TWENTIES',
       CASE WHEN i % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
       90, 999999, now(), now()
FROM generate_series(1, :n) AS i;

-- 핀 작성자 (nickname: ltown1 ~)
INSERT INTO members (id, nickname, age_group, gender, view_angle, credit_balance, created_at, updated_at)
SELECT 920000 + i, 'ltown' || i, 'THIRTIES',
       CASE WHEN i % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END,
       90, 999999, now(), now()
FROM generate_series(1, :n) AS i;

-- ---------- 3. 테스트 장소 ----------
INSERT INTO places (id, kakao_place_id, name, location, category,
                    category_group_code, category_group_name, category_name,
                    phone, address_name, created_at, updated_at)
VALUES (990001, 'loadtest-place-1', '부하테스트카페',
        ST_SetSRID(ST_MakePoint(127.9552, 36.5372), 4326)::geography,
        'CAFE'::category_type,
        'CE7', '카페', '음식점 > 카페 > 부하테스트',
        '', '충북 어딘가 산속', now(), now());

-- ---------- 4. 활성 핀 (작성자 1명당 1개) ----------
-- created_at 최근 1시간 + expires_at 1시간 후 + video_status ACTIVE 여야
-- 지도 조회 / 핀 상세 / 장소 홈 모든 쿼리에서 살아있는 핀으로 잡힌다.
-- 시드 후 1시간이 지나면 refresh-pins.sql 로 갱신할 것.
INSERT INTO pins (id, member_id, place_id, publisher_status, video_status, crowd_level,
                  capture_location, detail_location, memo,
                  original_video_key, blurred_video_key, thumbnail_key,
                  expires_at, created_at, updated_at)
SELECT gen_random_uuid(), 920000 + i, 990001, 'STILL_HERE', 'ACTIVE',
       CASE WHEN i % 4 = 0 THEN 'WAGLE' ELSE 'WAGLE_WAGLE' END,
       ST_SetSRID(ST_MakePoint(127.9552, 36.5372), 4326)::geography,
       '부하테스트 지점', '부하테스트 핀 ' || i,
       'loadtest/original/' || i || '.mp4',
       'loadtest/blurred/'  || i || '.mp4',
       'loadtest/thumb/'    || i || '.jpg',
       now() + interval '1 hour', now(), now()
FROM generate_series(1, :n) AS i;

-- ---------- 5. 활성 채팅방 (요청자 i <-> 작성자 i 의 핀) ----------
INSERT INTO chat_rooms (pin_id, requester_id, recipient_id, status, created_at, updated_at)
SELECT p.id, 910000 + (p.member_id - 920000), p.member_id, 'ACTIVE', now(), now()
FROM pins p
WHERE p.member_id BETWEEN 920001 AND 920000 + :n;

INSERT INTO chat_room_members (chat_room_id, member_id, created_at, updated_at)
SELECT r.id, r.requester_id, now(), now()
FROM chat_rooms r WHERE r.requester_id BETWEEN 910001 AND 910000 + :n
UNION ALL
SELECT r.id, r.recipient_id, now(), now()
FROM chat_rooms r WHERE r.requester_id BETWEEN 910001 AND 910000 + :n;

-- ---------- 6. 시퀀스 보정 (identity 컬럼에 명시 ID를 넣었으므로) ----------
SELECT setval(pg_get_serial_sequence('members', 'id'), (SELECT MAX(id) FROM members));
SELECT setval(pg_get_serial_sequence('places',  'id'), (SELECT MAX(id) FROM places));

COMMIT;

-- 확인용 출력
SELECT
  (SELECT count(*) FROM members WHERE id BETWEEN 910001 AND 930000) AS loadtest_members,
  (SELECT count(*) FROM pins WHERE member_id BETWEEN 920001 AND 930000) AS loadtest_pins,
  (SELECT count(*) FROM chat_rooms WHERE requester_id BETWEEN 910001 AND 920000) AS loadtest_chat_rooms;
