-- V8: AI 블러 작업(ai_blur_jobs) 스키마
-- 비동기 핀 등록 흐름에서 원본 영상 1건에 대한 AI 블러 처리 작업 1건을 저장한다.
-- AiBlurJob 엔티티 매핑과 1:1 로 일치시켜 ddl-auto=validate 를 통과시킨다.
-- job_type/status 는 프로젝트 관례(enum 은 자바에서 관리)에 따라 VARCHAR(255) 로 저장한다.

CREATE TABLE ai_blur_jobs (
    request_id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id             uuid          NOT NULL,
    original_video_key VARCHAR(1024) NOT NULL,
    job_type           VARCHAR(255)  NOT NULL,
    status             VARCHAR(255)  NOT NULL,
    created_at         TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at       TIMESTAMP(6) WITH TIME ZONE,

    -- 하나의 핀에 최초 등록(INITIAL_UPLOAD)·영상 교체(VIDEO_REPLACEMENT) 작업이
    -- 여러 개 생길 수 있으므로 pin_id 에는 UNIQUE 를 두지 않는다.
    CONSTRAINT fk_ai_blur_jobs_pin
        FOREIGN KEY (pin_id) REFERENCES pins (id),

    -- 동일 원본 영상 키가 둘 이상의 AI 작업에 재사용되지 않도록 DB 레벨에서 보장한다.
    CONSTRAINT uk_ai_blur_jobs_original_video_key
        UNIQUE (original_video_key)
);

-- 핀별 작업 이력 조회용
CREATE INDEX idx_ai_blur_jobs_pin_id
    ON ai_blur_jobs (pin_id);

-- 재발행 대상(특정 status 를 created_at 오래된 순으로) 조회용
CREATE INDEX idx_ai_blur_jobs_status_created_at
    ON ai_blur_jobs (status, created_at);
