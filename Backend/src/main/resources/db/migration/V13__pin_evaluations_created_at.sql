-- V13: pin_evaluations 등록 시각 기록
-- '내 프로필·활동 요약' 조회의 helpfulEvaluationCount는 평가 등록 완료 시점을 서비스 날짜로
-- 변환해 월별 집계한다. 기존 pin_evaluations에는 시각 컬럼이 없어 집계 기준을 만들 수 없으므로
-- BaseEntity(created_at/updated_at)와 정합하도록 두 컬럼을 추가한다.
-- 값은 애플리케이션 실행 시 JPA Auditing(@EnableJpaAuditing)이 채운다. pins 등 다른 BaseEntity
-- 테이블과 동일하게 nullable로 두어(값을 앱이 채우는 규약), @DataJpaTest(Auditing 미로딩)에서
-- 저장되는 행이 NOT NULL 제약에 걸리지 않게 한다.
ALTER TABLE pin_evaluations
    ADD COLUMN created_at TIMESTAMP(6) WITH TIME ZONE,
    ADD COLUMN updated_at TIMESTAMP(6) WITH TIME ZONE;

-- 월별 HELPFUL 평가 수 집계가 created_at 범위로 조회되므로 인덱스를 건다.
CREATE INDEX idx_pin_evaluations_created_at ON pin_evaluations (created_at);
