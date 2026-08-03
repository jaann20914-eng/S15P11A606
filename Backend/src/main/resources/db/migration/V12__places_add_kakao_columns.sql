-- V12: places 에 카카오 장소 부가 정보 컬럼 추가
-- 핀 등록 시 프론트가 전달한 카카오 장소 정보(카테고리·연락처·지번주소)를 저장한다.
-- Place 엔티티 매핑과 1:1 로 일치시켜 ddl-auto=validate 를 통과시킨다.
-- 카카오가 값을 주지 않는 장소가 흔하고 기존 places 행에도 값이 없어 기본값 '' 로 채운다.

ALTER TABLE places
    ADD COLUMN category_group_code VARCHAR(10)  NOT NULL DEFAULT '',
    ADD COLUMN category_group_name VARCHAR(50)  NOT NULL DEFAULT '',
    ADD COLUMN phone               VARCHAR(50)  NOT NULL DEFAULT '',
    ADD COLUMN address_name        VARCHAR(255) NOT NULL DEFAULT '';
