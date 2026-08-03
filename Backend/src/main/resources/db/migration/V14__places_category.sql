-- V14: places 카테고리(category) 컬럼 및 category_name 추가
-- 추천 기능이 AI 추천점수 API에 넘길 6종 카테고리(+ETC)를 장소에 저장한다.
-- Place 엔티티 매핑과 1:1 로 일치시켜 ddl-auto=validate 를 통과시킨다.

-- 값이 6종(+ETC)으로 제한되도록 PostgreSQL enum 타입으로 정의한다.
CREATE TYPE category_type AS ENUM (
    'CAFE',
    'RESTAURANT',
    'SHOPPING_MALL',
    'CULTURE_EXHIBITION',
    'TOURIST_ATTRACTION',
    'PARK',
    'ETC'
    );

ALTER TABLE places
    ADD COLUMN category_name VARCHAR(255),
    ADD COLUMN category      category_type;

-- 기존 행 백필: 카카오 그룹코드 기준으로 4종을 매핑하고 그 외는 ETC.
-- (SHOPPING_MALL/PARK는 category_name이 없어 소급 불가하므로 ETC로 둔다.)
UPDATE places
SET category = CASE category_group_code
                   WHEN 'CE7' THEN 'CAFE'
                   WHEN 'FD6' THEN 'RESTAURANT'
                   WHEN 'CT1' THEN 'CULTURE_EXHIBITION'
                   WHEN 'AT4' THEN 'TOURIST_ATTRACTION'
                   ELSE 'ETC'
    END::category_type;

ALTER TABLE places
    ALTER COLUMN category SET NOT NULL;

-- 카카오가 값을 주지 않는 장소가 흔해 그룹코드/그룹명은 NULL 을 허용한다.
ALTER TABLE places
    ALTER COLUMN category_group_code DROP NOT NULL,
    ALTER COLUMN category_group_code DROP DEFAULT,
    ALTER COLUMN category_group_name DROP NOT NULL,
    ALTER COLUMN category_group_name DROP DEFAULT;
