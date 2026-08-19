-- =====================================================================
-- AI 블러 결과 Consumer 전용 벤치마크 데이터 생성
--
-- 사전 조건: loadtest/seed/seed.sql이 적용되어 member 920001, place 990001이 존재해야 한다.
-- 실행 예시(n=1000):
--   docker exec -i waggle-postgis psql -U waggle -d wagglewaggle \
--     -v ON_ERROR_STOP=1 -v n=1000 -qAt \
--     < consumer-benchmark/seed.sql > consumer-benchmark/messages.jsonl
--
-- 출력: RabbitMQ ai.blur.result로 발행할 FAILED 결과 메시지 JSON Lines.
-- FAILED 경로를 사용해 AI와 S3 시간을 제외하고 Consumer의 DB 반영 처리량만 비교한다.
-- =====================================================================

\if :{?n}
\else
\set n 1000
\endif

BEGIN;

-- 이전 Consumer 벤치마크 데이터만 제거한다. 일반 k6 시드 Pin은 유지한다.
DELETE FROM ai_blur_jobs
WHERE original_video_key LIKE 'loadtest/consumer-benchmark/%';

DELETE FROM pins
WHERE original_video_key LIKE 'loadtest/consumer-benchmark/%';

CREATE TEMP TABLE consumer_benchmark_cases (
    pin_id uuid PRIMARY KEY,
    request_id uuid NOT NULL UNIQUE,
    original_video_key varchar(1024) NOT NULL
);

INSERT INTO consumer_benchmark_cases (pin_id, request_id, original_video_key)
SELECT pin_id,
       gen_random_uuid(),
       'loadtest/consumer-benchmark/' || pin_id || '.mp4'
FROM (
    SELECT gen_random_uuid() AS pin_id
    FROM generate_series(1, :n)
) generated;

INSERT INTO pins (
    id, member_id, place_id, publisher_status, video_status, crowd_level,
    capture_location, detail_location, memo, original_video_key,
    blurred_video_key, thumbnail_key, expires_at, deleted_at, created_at, updated_at
)
SELECT pin_id,
       920001,
       990001,
       'STILL_HERE',
       'PENDING',
       'WAGLE_WAGLE',
       ST_SetSRID(ST_MakePoint(127.9552, 36.5372), 4326)::geography,
       'Consumer 벤치마크',
       'Consumer 벤치마크 Pin',
       original_video_key,
       NULL,
       NULL,
       NULL,
       NULL,
       now(),
       now()
FROM consumer_benchmark_cases;

INSERT INTO ai_blur_jobs (
    request_id, pin_id, original_video_key, job_type, status,
    final_status, created_at, completed_at, version
)
SELECT request_id,
       pin_id,
       original_video_key,
       'INITIAL_UPLOAD',
       'PENDING',
       NULL,
       now(),
       NULL,
       0
FROM consumer_benchmark_cases;

COMMIT;

-- -qAt 옵션으로 실행하면 아래 JSON만 한 줄에 하나씩 출력된다.
SELECT json_build_object(
           'requestId', request_id,
           'pinId', pin_id,
           'processingStatus', 'FAILED',
           'finalStatus', NULL,
           'blurredVideoKey', NULL,
           'thumbnailKey', NULL,
           'code', NULL,
           'errorCode', 'CONSUMER_BENCHMARK',
           'completedAt', to_char(
               clock_timestamp() AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
           )
       )::text
FROM consumer_benchmark_cases
ORDER BY request_id;
