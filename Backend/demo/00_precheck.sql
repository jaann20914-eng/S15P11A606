-- [DEMO] 시연 데이터 세팅 전 사전 점검. (읽기 전용, 아무것도 바꾸지 않음)
-- 재사용 가능한 blur/썸네일 key를 가진 핀이 몇 개인지, 회원이 있는지 확인한다.
-- reusable_key_pins 가 1 이상이면 setup 가능(부족해도 key를 순환 복사하므로 최소 1개면 됨).

SELECT
  (SELECT count(*) FROM members)                                                       AS members,
  (SELECT count(*) FROM pins
     WHERE blurred_video_key IS NOT NULL
       AND thumbnail_key    IS NOT NULL
       AND original_video_key NOT LIKE 'demo/%')                                       AS reusable_key_pins,
  (SELECT count(*) FROM places
     WHERE ST_DWithin(location,
             ST_SetSRID(ST_MakePoint(127.04403462366, 37.503325874722), 4326)::geography,
             1000))                                                                    AS existing_places_within_1km;
