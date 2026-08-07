-- [DEMO] 시연용 음식점 핀 세팅 (끝나면 99_rollback.sql 로 원복)
-- 기준 위치: 위도 37.503325874722, 경도 127.04403462366 (반경 1km 이내에 흩음)
-- 방식: 새 place 14개(전부 RESTAURANT) + 새 pin 14개를 INSERT 한다.
--       영상은 기존 핀의 blurred_video_key / thumbnail_key 만 복사해 재생이 되게 하고,
--       원본 핀/장소 데이터는 전혀 건드리지 않는다. (original_video_key 는 'demo/pin-NN' 더미)
-- 혼잡도: 7개는 와글(WAGLE_WAGLE/WAGLE, 평균≥3 → 지도 라벨 WAGLE),
--         7개는 여유(RELAXED/LEISURELY, 평균<3 → 지도 라벨 RELAXED).
-- 식별자: place.kakao_place_id LIKE 'DEMO_%', pin.original_video_key LIKE 'demo/%' → 롤백 기준.
-- 멱등: 다시 돌리려면 먼저 99_rollback.sql 을 실행해 기존 DEMO 데이터를 지운 뒤 재실행할 것.

BEGIN;

-- 1) 데모 장소 14개 (전부 RESTAURANT, 기준점 대비 오프셋으로 1km 내 분산)
WITH center(lat, lng) AS (
    VALUES (37.503325874722::float8, 127.04403462366::float8)
),
place_seed(ord, name, dlat, dlng) AS (
    VALUES
        (1,  '강남 숯불갈비',    0.0015,  0.0015),
        (2,  '역삼 왕돈까스',    0.0030, -0.0010),
        (3,  '테헤란 국밥집',   -0.0020,  0.0025),
        (4,  '선릉 마라탕',      0.0010, -0.0030),
        (5,  '강남역 파스타',   -0.0035, -0.0015),
        (6,  '역삼 초밥천국',    0.0040,  0.0020),
        (7,  '뱅뱅 부대찌개',   -0.0010,  0.0040),
        (8,  '조용한 한상',      0.0025,  0.0035),
        (9,  '골목 백반',       -0.0030, -0.0035),
        (10, '한적한 밥집',      0.0045, -0.0025),
        (11, '여유 브런치',     -0.0045,  0.0010),
        (12, '소담 김밥',        0.0005,  0.0048),
        (13, '느린 식탁',       -0.0025, -0.0045),
        (14, '한갓진 우동',      0.0038,  0.0042)
)
INSERT INTO places (kakao_place_id, name, location, category, phone, address_name, created_at, updated_at)
SELECT 'DEMO_' || lpad(ps.ord::text, 2, '0'),
       ps.name,
       ST_SetSRID(ST_MakePoint(c.lng + ps.dlng, c.lat + ps.dlat), 4326)::geography,
       'RESTAURANT'::category_type,
       '', '',
       now(), now()
FROM place_seed ps CROSS JOIN center c;

-- 2) 데모 핀 14개 (장소당 1핀). 기존 핀의 blur/썸네일 key 를 순환 복사한다.
WITH src AS (
    SELECT blurred_video_key,
           thumbnail_key,
           row_number() OVER (ORDER BY created_at DESC NULLS LAST, id) AS rn
    FROM pins
    WHERE blurred_video_key IS NOT NULL
      AND thumbnail_key    IS NOT NULL
      AND original_video_key NOT LIKE 'demo/%'
),
src_n AS (SELECT count(*)::int AS n FROM src),
demo_place AS (
    SELECT id AS place_id,
           location,
           (substr(kakao_place_id, 6))::int AS ord   -- 'DEMO_07' → 7
    FROM places
    WHERE kakao_place_id LIKE 'DEMO_%'
),
crowd(ord, level) AS (
    VALUES
        (1,'WAGLE_WAGLE'),(2,'WAGLE_WAGLE'),(3,'WAGLE_WAGLE'),
        (4,'WAGLE'),(5,'WAGLE'),(6,'WAGLE'),(7,'WAGLE'),
        (8,'RELAXED'),(9,'RELAXED'),(10,'RELAXED'),(11,'RELAXED'),
        (12,'LEISURELY'),(13,'LEISURELY'),(14,'LEISURELY')
),
demo_member AS (SELECT id FROM members ORDER BY id LIMIT 1)
INSERT INTO pins (member_id, place_id, publisher_status, video_status, crowd_level,
                  capture_location, original_video_key, blurred_video_key, thumbnail_key,
                  expires_at, created_at, updated_at)
SELECT (SELECT id FROM demo_member),
       dp.place_id,
       'STILL_HERE',
       'ACTIVE',
       c.level,
       dp.location,                                  -- 핀 좌표 = 장소 좌표
       'demo/pin-' || lpad(dp.ord::text, 2, '0'),
       s.blurred_video_key,
       s.thumbnail_key,
       now() + interval '7 days',
       now(), now()
FROM demo_place dp
JOIN crowd c ON c.ord = dp.ord
JOIN src_n  ON true
JOIN src s  ON s.rn = ((dp.ord - 1) % NULLIF(src_n.n, 0)) + 1;

-- 3) 확인
SELECT pl.name,
       pin.crowd_level,
       pin.video_status,
       pin.expires_at,
       left(pin.blurred_video_key, 40) AS blurred_key_preview
FROM pins pin
JOIN places pl ON pl.id = pin.place_id
WHERE pin.original_video_key LIKE 'demo/%'
ORDER BY pl.kakao_place_id;

COMMIT;
