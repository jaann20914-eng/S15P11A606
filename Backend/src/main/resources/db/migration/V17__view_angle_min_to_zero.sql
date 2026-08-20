-- V17: 온도(view_angle) 하한을 90 -> 0 으로 완화
--  기존 CHECK(view_angle BETWEEN 90 AND 360) 제약을 0~360 으로 교체한다.
--  상한(360)과 NUMERIC(4,1) 타입, DEFAULT 90 은 그대로 유지한다.

ALTER TABLE members
    DROP CONSTRAINT ck_members_view_angle;

ALTER TABLE members
    ADD CONSTRAINT ck_members_view_angle CHECK (view_angle BETWEEN 0 AND 360);
