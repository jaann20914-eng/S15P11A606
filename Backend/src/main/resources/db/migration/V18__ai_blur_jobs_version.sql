-- 같은 AI 블러 작업의 동시 수정을 감지하기 위한 JPA 낙관적 락 버전이다.
-- 기존 작업은 최초 버전 0부터 시작하고, 이후 변경할 때마다 Hibernate가 1씩 증가시킨다.
ALTER TABLE ai_blur_jobs
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
