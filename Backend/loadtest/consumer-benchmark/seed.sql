-- =====================================================================
-- AI 블러 결과 Consumer 전용 벤치마크 데이터 생성
--
-- 사전 조건: loadtest/seed/seed.sql이 적용되어 member 920001, place 990001이 존재해야 한다.
-- FAILED 실행 예시(n=1000, 기본값):
--   docker exec -i waggle-postgis psql -U waggle -d wagglewaggle \
--     -v ON_ERROR_STOP=1 -v n=1000 -qAt \
--     < consumer-benchmark/seed.sql > consumer-benchmark/messages.jsonl
--
-- PASS 실행 예시(n=1000):
--   docker exec -i waggle-postgis psql -U waggle -d wagglewaggle \
--     -v ON_ERROR_STOP=1 -v n=1000 -v result_mode=PASS -qAt \
--     < consumer-benchmark/seed.sql > consumer-benchmark/messages.jsonl
--
-- 출력: RabbitMQ ai.blur.result로 발행할 결과 메시지 JSON Lines.
-- FAILED는 DB 반영 처리량, PASS는 S3 객체 확인과 검색 색인을 포함한 실제 성공 경로를 측정한다.
-- =====================================================================

\if :{?n}
\else
\set n 1000
\endif

\if :{?result_mode}
\else
\set result_mode FAILED
\endif

\if :{?blurred_key}
\else
\set blurred_key loadtest/consumer-benchmark/shared-blurred.mp4
\endif

\if :{?thumbnail_key}
\else
\set thumbnail_key loadtest/consumer-benchmark/shared-thumbnail.jpg
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

CREATE TEMP TABLE consumer_benchmark_config (
    result_mode varchar(10) NOT NULL CHECK (result_mode IN ('FAILED', 'PASS')),
    blurred_key varchar(1024) NOT NULL CHECK (length(trim(blurred_key)) > 0),
    thumbnail_key varchar(1024) NOT NULL CHECK (length(trim(thumbnail_key)) > 0)
);

INSERT INTO consumer_benchmark_config (result_mode, blurred_key, thumbnail_key)
VALUES (upper(:'result_mode'), :'blurred_key', :'thumbnail_key');

INSERT INTO consumer_benchmark_cases (pin_id, request_id, original_video_key)
SELECT pin_id,
       md5('loadtest-consumer-benchmark-request-' || sequence_number)::uuid,
       'loadtest/consumer-benchmark/' || pin_id || '.mp4'
FROM (
    SELECT sequence_number,
           md5('loadtest-consumer-benchmark-pin-' || sequence_number)::uuid AS pin_id
    FROM generate_series(1, :n) AS generated_numbers(sequence_number)
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
           'processingStatus', CASE WHEN result_mode = 'PASS' THEN 'COMPLETED' ELSE 'FAILED' END,
           'finalStatus', CASE WHEN result_mode = 'PASS' THEN 'PASS' ELSE NULL END,
           'blurredVideoKey', CASE WHEN result_mode = 'PASS' THEN blurred_key ELSE NULL END,
           'thumbnailKey', CASE WHEN result_mode = 'PASS' THEN thumbnail_key ELSE NULL END,
           'code', NULL,
           'errorCode', CASE WHEN result_mode = 'FAILED' THEN 'CONSUMER_BENCHMARK' ELSE NULL END,
           'completedAt', to_char(
               clock_timestamp() AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
           )
       )::text
FROM consumer_benchmark_cases
CROSS JOIN consumer_benchmark_config
ORDER BY request_id;
