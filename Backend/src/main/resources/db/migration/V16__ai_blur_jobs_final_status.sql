-- V16: ai_blur_jobs 에 최종 판정 결과(final_status) 컬럼 추가
-- COMPLETED 작업이 PASS 인지 FAIL 인지 구분해, 동일 requestId 의 결과가 다시 도착했을 때
-- 정상 중복(같은 결과)과 충돌(다른 결과)을 정확히 판정하기 위함이다.
--   - PASS/FAIL 로 COMPLETED 된 작업: PASS 또는 FAIL 을 저장한다.
--   - FAILED(시스템 오류) 작업: status=FAILED 로 구분되므로 final_status 는 null 이다.
--   - PENDING 작업: null.
-- enum 은 프로젝트 관례상 자바에서 관리하므로 VARCHAR(255) 로 저장한다.
-- 기존(legacy) COMPLETED 행은 null 로 남으며, 이 경우 결과 재도착 판정은 기존과 동일하게
-- processingStatus 기준의 완화된 중복 처리를 유지한다(백필하지 않는다).

ALTER TABLE ai_blur_jobs
    ADD COLUMN final_status VARCHAR(255);
