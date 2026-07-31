-- V5: 핀(pins) soft-delete 컬럼 추가
-- Pin 엔티티의 deletedAt 매핑과 1:1 로 일치시켜 ddl-auto=validate 를 통과시킨다.
-- 삭제된 핀은 장소 홈 활성 핀 목록과 요일별 혼잡 통계 집계에서 제외된다(deleted_at IS NULL 필터).

ALTER TABLE pins
    ADD COLUMN deleted_at TIMESTAMP(6) WITH TIME ZONE;
