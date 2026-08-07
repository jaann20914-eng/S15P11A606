-- [DEMO] 시연용 음식점 핀 세팅 (끝나면 99_rollback.sql 로 원복)
-- 실제 카카오 Local 데이터(역삼동 음식점 15곳) 기반. 실제 kakao_place_id 를 쓰므로
-- 지도가 카카오 실시간 매칭으로 주소·전화를 정상 채운다.
-- 방식: 해당 장소가 없으면 INSERT(있으면 재사용) + 새 pin 15개 INSERT.
--       영상은 기존 핀의 blurred_video_key / thumbnail_key 만 순환 복사(원본 데이터 무손상).
-- 혼잡도: 와글 8 (WAGLE_WAGLE/WAGLE, 평균≥3), 여유 7 (RELAXED/LEISURELY, 평균<3).
-- 롤백 식별: pin.original_video_key LIKE 'demo/%'  /  장소는 아래 kakao_place_id 목록 중 "데모 때 새로 생성돼 고아가 된" 행만 삭제.
-- 멱등: 다시 돌리려면 먼저 99_rollback.sql 로 데모 핀을 지운 뒤 재실행.

BEGIN;

-- 1) 장소: 없으면 생성(있으면 재사용). created_at=now() 로 찍혀 롤백 시 "데모가 만든 장소"를 식별한다.
WITH seed(kakao_id, name, lng, lat, cat_name, phone, road_addr) AS (
    VALUES
        ('327148272',  '서울집',                127.03989994556534, 37.503623202534165, '음식점 > 한식',                          '02-501-2126',   '서울 강남구 언주로93길 22-3'),
        ('21960500',   '일품헌 역삼점',          127.03962837217611, 37.50334848725466,  '음식점 > 샤브샤브',                      '02-574-7117',   '서울 강남구 언주로93길 30'),
        ('170118016',  '복돈이가마솥순대국',     127.04052425074,    37.5036608322466,   '음식점 > 한식 > 순대',                    '02-501-0777',   '서울 강남구 테헤란로37길 22'),
        ('2142723351', '해담채 강남점',          127.03242183211198, 37.497775259854485, '음식점 > 한식 > 한정식',                  '02-558-4997',   '서울 강남구 논현로85길 70'),
        ('2044587542', '이타닉 가든',            127.04118315776,    37.5028641154494,   '음식점 > 한식',                          '02-727-7610',   '서울 강남구 테헤란로 231'),
        ('1050527540', '고우가 역삼역점',        127.036508733456,   37.5000238801142,   '음식점 > 한식 > 육류,고기',              '02-555-9554',   '서울 강남구 테헤란로 152'),
        ('1749534812', '안목 강남역삼',          127.04197037949406, 37.50504156856544,  '음식점 > 한식 > 국밥',                    '010-7271-7824', '서울 강남구 언주로 520'),
        ('27440874',   '상황버섯 약수삼계탕',    127.03652959419871, 37.503381021349036, '음식점 > 한식 > 육류,고기 > 닭요리 > 삼계탕', '02-548-8835', '서울 강남구 봉은사로30길 64'),
        ('8144397',    '강강술래 역삼점',        127.03968572363503, 37.49418343234461,  '음식점 > 한식',                          '02-567-9233',   '서울 강남구 논현로 325'),
        ('8095238',    '진수사',                127.040125687241,   37.5027851908828,   '음식점 > 일식 > 일식집',                  '0507-1397-3544','서울 강남구 테헤란로37길 13-7'),
        ('26576845',   '순남시래기 역삼점',      127.040219864405,   37.5012534490653,   '음식점 > 한식',                          '02-508-0887',   '서울 강남구 테헤란로34길 5'),
        ('1353935275', '하몽하몽이베리코 역삼점', 127.040094261884,   37.503235704357,    '음식점 > 한식 > 육류,고기 > 삼겹살',      '02-3482-8892',  '서울 강남구 언주로93길 25'),
        ('25968685',   '꽃새우영번지 역삼점',    127.041371600279,   37.5061941654576,   '음식점 > 한식 > 해물,생선',              '02-501-2050',   '서울 강남구 언주로 536'),
        ('11831489',   '역삼동북어집',          127.036730818308,   37.4985912114461,   '음식점 > 한식 > 해물,생선',              '02-558-6605',   '서울 강남구 논현로85길 5-14'),
        ('8652100',    '고래불 강남역삼본점',    127.03396137926865, 37.49625663127778,  '음식점 > 한식 > 해물,생선 > 회',          '02-556-3677',   '서울 강남구 논현로79길 62')
)
INSERT INTO places (kakao_place_id, name, location, category, category_group_code, category_group_name, category_name, phone, address_name, created_at, updated_at)
SELECT s.kakao_id, s.name,
       ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
       'RESTAURANT'::category_type,
       'FD6', '음식점', s.cat_name, s.phone, s.road_addr,
       now(), now()
FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM places p WHERE p.kakao_place_id = s.kakao_id);

-- 2) 핀: 장소당 1개. 기존 핀의 blur/썸네일 key 를 순환 복사한다.
--    ※ 서버는 원본 로직(지도 created_at 최근 1시간 창 / 활성화시각 = expiresAt-1h)으로 되돌린 상태다.
--    그래서 이 더미는 "방금 등록된 실제 핀"처럼 넣는다 → 시연 직전에 실행할 것(약 1시간 노출).
--    created_at 은 "몇 분 전 등록" 표기가 다양하게 보이도록 1~15분 전으로 흩뿌린다(1시간 창 안에서 여유 확보).
--    expires_at 은 now()+1h 로 고정(원본 TTL과 동일 → AI에 보내는 활성화시각도 ≈now 로 정상).
WITH seed(ord, kakao_id, crowd, mins_ago) AS (
    VALUES
        (1, '327148272',  'WAGLE_WAGLE', 1),
        (2, '21960500',   'WAGLE_WAGLE', 2),
        (3, '170118016',  'WAGLE',       4),
        (4, '2142723351', 'RELAXED',     6),
        (5, '2044587542', 'WAGLE_WAGLE', 7),
        (6, '1050527540', 'WAGLE',       9),
        (7, '1749534812', 'RELAXED',     11),
        (8, '27440874',   'LEISURELY',   13),
        (9, '8144397',    'RELAXED',     15),
        (10,'8095238',    'WAGLE',       3),
        (11,'26576845',   'WAGLE_WAGLE', 5),
        (12,'1353935275', 'WAGLE',       8),
        (13,'25968685',   'LEISURELY',   10),
        (14,'11831489',   'RELAXED',     12),
        (15,'8652100',    'LEISURELY',   14)
),
place_pick AS (
    SELECT s.ord, s.crowd, s.mins_ago, p.id AS place_id, p.location AS loc
    FROM seed s
    JOIN LATERAL (
        SELECT id, location FROM places WHERE kakao_place_id = s.kakao_id ORDER BY id LIMIT 1
    ) p ON true
),
src AS (
    SELECT blurred_video_key, thumbnail_key,
           row_number() OVER (ORDER BY created_at DESC NULLS LAST, id) AS rn
    FROM pins
    WHERE blurred_video_key IS NOT NULL
      AND thumbnail_key    IS NOT NULL
      AND original_video_key NOT LIKE 'demo/%'
),
src_n AS (SELECT count(*)::int AS n FROM src),
demo_member AS (SELECT id FROM members ORDER BY id LIMIT 1)
INSERT INTO pins (member_id, place_id, publisher_status, video_status, crowd_level,
                  capture_location, original_video_key, blurred_video_key, thumbnail_key,
                  expires_at, created_at, updated_at)
SELECT (SELECT id FROM demo_member),
       pp.place_id,
       'STILL_HERE',
       'ACTIVE',
       pp.crowd,
       pp.loc,                                        -- 핀 좌표 = 장소 좌표
       'demo/pin-' || lpad(pp.ord::text, 2, '0'),
       s.blurred_video_key,
       s.thumbnail_key,
       now() + interval '1 hour',                          -- expires_at (원본 TTL과 동일하게 1시간)
       now() - (pp.mins_ago * interval '1 minute'),        -- created_at (1~15분 전으로 흩뿌림)
       now()
FROM place_pick pp
JOIN src_n ON true
JOIN src s ON s.rn = ((pp.ord - 1) % NULLIF(src_n.n, 0)) + 1;

-- 3) 확인 ("몇 분 전"이 다양하게 보이도록 created_at 이 흩어져 있는지 함께 확인)
SELECT pl.name,
       pin.crowd_level,
       pin.video_status,
       round(extract(epoch FROM (now() - pin.created_at)) / 60)::int AS mins_ago,
       pin.expires_at
FROM pins pin
JOIN places pl ON pl.id = pin.place_id
WHERE pin.original_video_key LIKE 'demo/%'
ORDER BY pin.created_at DESC;

COMMIT;
