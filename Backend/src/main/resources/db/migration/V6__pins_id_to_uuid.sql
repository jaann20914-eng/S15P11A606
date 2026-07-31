-- V6: pins PK BIGINT → UUID 전환
-- 개발 단계로 보존할 데이터가 없어(사용자 승인) TRUNCATE 후 타입을 변경한다.
-- (bigint → uuid 는 데이터가 있으면 캐스팅 불가하므로 빈 테이블을 보장한다.)
-- 자식 엔티티는 @ManyToOne Pin 객체 참조라 자바 코드 변경 없이 FK 컬럼 타입만 uuid 로 맞춘다.

-- pins 및 이를 참조하는 자식(pin_evaluations/pin_tags/pin_unlocks/chat_rooms 및 chat 하위)까지 정리
TRUNCATE pins CASCADE;

-- 자식 FK 제거 (참조 컬럼 타입 변경을 위해)
ALTER TABLE pin_evaluations DROP CONSTRAINT fk_pin_evaluations_pin;
ALTER TABLE pin_tags        DROP CONSTRAINT fk_pin_tags_pin;
ALTER TABLE pin_unlocks     DROP CONSTRAINT fk_pin_unlocks_pin;
ALTER TABLE chat_rooms      DROP CONSTRAINT fk_chat_rooms_pin;

-- pins.id: identity 제거 후 uuid 로 변경, 앱 미지정 시를 위한 DB 기본값 부여
ALTER TABLE pins ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE pins ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE pins ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 자식 pin_id: uuid 로 변경 (NOT NULL 유지, 빈 테이블이므로 USING 값은 무의미)
ALTER TABLE pin_evaluations ALTER COLUMN pin_id TYPE uuid USING (NULL::uuid);
ALTER TABLE pin_tags        ALTER COLUMN pin_id TYPE uuid USING (NULL::uuid);
ALTER TABLE pin_unlocks     ALTER COLUMN pin_id TYPE uuid USING (NULL::uuid);
ALTER TABLE chat_rooms      ALTER COLUMN pin_id TYPE uuid USING (NULL::uuid);

-- FK 재생성 (unique 제약·인덱스·pins PK 는 타입 변경 시 자동 재구축됨)
ALTER TABLE pin_evaluations ADD CONSTRAINT fk_pin_evaluations_pin FOREIGN KEY (pin_id) REFERENCES pins (id);
ALTER TABLE pin_tags        ADD CONSTRAINT fk_pin_tags_pin        FOREIGN KEY (pin_id) REFERENCES pins (id);
ALTER TABLE pin_unlocks     ADD CONSTRAINT fk_pin_unlocks_pin     FOREIGN KEY (pin_id) REFERENCES pins (id);
ALTER TABLE chat_rooms      ADD CONSTRAINT fk_chat_rooms_pin      FOREIGN KEY (pin_id) REFERENCES pins (id);
