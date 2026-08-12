-- 시드 핀의 유효시간 갱신.
-- 지도 조회는 "최근 1시간 내 생성 + 미만료" 핀만 보여주므로,
-- 시드 후 1시간이 지났다면 핀 조회 테스트 전에 이 스크립트를 다시 실행한다.
--
-- 사용법: psql "$DATABASE_URL" -f refresh-pins.sql

UPDATE pins
SET created_at = now(),
    updated_at = now(),
    expires_at = now() + interval '1 hour'
WHERE member_id BETWEEN 920001 AND 930000;
