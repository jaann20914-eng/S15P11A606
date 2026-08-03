-- V15: pin_unlocks 등록 시각 기록
-- 추천 기능이 장소별 '최근 7일 열람수(unlockCount7d)'를 집계하는데, 기존 pin_unlocks에는
-- 시각 컬럼이 없어 기간 집계 기준을 만들 수 없다. BaseEntity(created_at/updated_at)와 정합하도록
-- 두 컬럼을 추가한다. 값은 애플리케이션 실행 시 JPA Auditing(@EnableJpaAuditing)이 채우며,
-- pins 등 다른 BaseEntity 테이블과 동일하게 nullable로 둔다(@DataJpaTest에서 Auditing 미로딩 시
-- NOT NULL 제약에 걸리지 않게 하기 위함).
-- 기존 행은 created_at이 NULL이라 7일 집계에서 자연히 제외된다(과거 열람을 현재로 소급하지 않음).
ALTER TABLE pin_unlocks
    ADD COLUMN created_at TIMESTAMP(6) WITH TIME ZONE,
    ADD COLUMN updated_at TIMESTAMP(6) WITH TIME ZONE;

-- 최근 7일 열람수 집계가 created_at 범위로 조회되므로 인덱스를 건다.
CREATE INDEX idx_pin_unlocks_created_at ON pin_unlocks (created_at);
