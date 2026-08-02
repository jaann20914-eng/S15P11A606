-- V11: 온도(view_angle) 소수화
--  핀 평가 반영에서 NOT_HELPFUL 은 작성자 뷰를 -0.5 만큼 변화시키므로,
--  정수 컬럼으로는 표현할 수 없다. 범위(90~360)와 0.5 단위를 담기 위해 NUMERIC(4,1)로 전환한다.
--  기존 CHECK(view_angle BETWEEN 90 AND 360) 제약과 DEFAULT 90 은 그대로 유효하다.

-- (1) members.view_angle: INTEGER -> NUMERIC(4,1)
ALTER TABLE members
    ALTER COLUMN view_angle TYPE NUMERIC(4, 1) USING view_angle::numeric(4, 1),
    ALTER COLUMN view_angle SET DEFAULT 90;

-- (2) view_transactions.change_amount, view_after: INTEGER -> NUMERIC(4,1)
--     change_amount 는 +1(HELPFUL) / -0.5(NOT_HELPFUL) 등 0.5 단위 변동을 담는다.
ALTER TABLE view_transactions
    ALTER COLUMN change_amount TYPE NUMERIC(4, 1) USING change_amount::numeric(4, 1),
    ALTER COLUMN view_after    TYPE NUMERIC(4, 1) USING view_after::numeric(4, 1);
