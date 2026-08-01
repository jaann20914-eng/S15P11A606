-- V8: search_histories 에 kakao_place_id 컬럼 추가
-- 장소 검색 확정 시 우리 DB에 없는 장소(place_id NULL)도 카카오 장소 ID를 남기기 위함.
-- 엔티티 매핑(String, VARCHAR(200))과 1:1 로 일치시켜 ddl-auto=validate 를 통과시킨다.
-- TAG 검색인 경우 NULL 이다.

ALTER TABLE search_histories
    ADD COLUMN kakao_place_id VARCHAR(200);
