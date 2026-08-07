# 시연용 임시 변경 — 롤백 참조

시연 안정성을 위해 넣은 임시 변경 전체 목록과 원복 방법. **시연 종료 후 반드시 되돌릴 것.**

- 기준 브랜치: `fix/backend/pins-location-update`
- 변경 직전 baseline 커밋: `05be528`
- 컨테이너: 백엔드 `waggle-backend`, DB `waggle-postgis` (DB명 `wagglewaggle`, 유저 `waggle`)

---

## A. 코드 변경 (배포 반영 — 원복하려면 재배포 필요)

모두 `// [DEMO]` 주석으로 표시됨. 찾기: `grep -rn "\[DEMO\]" Backend/src`

| 파일 | 상수 | 원래 값 | 변경 값 | 이유 |
|------|------|---------|---------|------|
| `place/service/PlacePinService.java` | `ACTIVE_WINDOW` | `Duration.ofHours(1)` | `Duration.ofDays(8)` | 지도 목록 `created_at` 최근성 창 확대(핀 일주일 유지) |
| `place/service/PlaceDetailService.java` | `ACTIVE_WINDOW` | `Duration.ofHours(1)` | `Duration.ofDays(8)` | 장소 홈 동일 |
| `recommendation/service/AiCandidateAssembler.java` | `ACTIVE_VIDEO_TTL` | `Duration.ofHours(1)` | `Duration.ofDays(7)` | AI에 보내는 활성화시각이 미래로 안 가게(expires-7d≈촬영시각) |
| `place/service/PlacePinServiceTest.java` | 윈도우 단언값 | `Duration.ofHours(1)` | `Duration.ofDays(8)` | 위 변경에 맞춰 CI 그린 유지 |

> **건드리지 않은 것:** `PlacePinService.MAX_RESULT`(=10), `Pin.ACTIVE_VIDEO_TTL`(엔티티, =1h). 관련 테스트 다수라 유지.

### 코드 원복 방법
- **방법 1 (권장):** 이 변경을 담은 커밋의 SHA를 기록해두고 `git revert <sha>` → 재배포.
- **방법 2 (수동):** 위 4개 파일에서 변경 값을 원래 값으로 되돌리고 `// [DEMO]` 주석 줄 제거 → 재배포.

---

## B. DB 변경 (배포와 무관, 즉시 반영)

`Backend/demo/` SQL로 넣은 데모 데이터.

| 스크립트 | 내용 | 식별자 |
|----------|------|--------|
| `01_setup.sql` | RESTAURANT place 14개 + pin 14개 INSERT (7일 만료, blur/썸네일 key 복사) | place: `kakao_place_id LIKE 'DEMO_%'`, pin: `original_video_key LIKE 'demo/%'` |
| `02_extend_recorded_pins.sql` | 직접 촬영한 히어로 핀의 `expires_at`을 7일로 UPDATE | 최근 2시간 내 등록된 ACTIVE·비데모 핀 |

### DB 원복 방법
1. 데모 INSERT 데이터 삭제:
   ```bash
   docker exec -i waggle-postgis psql -U waggle -d wagglewaggle < Backend/demo/99_rollback.sql
   ```
   (`pins.original_video_key LIKE 'demo/%'`, `places.kakao_place_id LIKE 'DEMO_%'` 삭제)
2. `02`로 연장했던 **히어로 핀**은 실제 촬영본이라 자동 삭제 대상이 아님. 처리 택1:
   - 앱에서 직접 삭제, 또는
   - 그대로 두고 7일 뒤 자연 만료, 또는
   - 즉시 만료 처리:
     ```sql
     UPDATE pins SET expires_at = now() - interval '1 minute'
     WHERE video_status='ACTIVE' AND deleted_at IS NULL
       AND original_video_key NOT LIKE 'demo/%'
       AND created_at >= '<촬영한 날짜>';   -- 대상 좁혀서 실행
     ```

---

## C. 주의
- `Backend/.claude/` 는 이번 시연 작업과 무관한 untracked 파일임 — **dev 머지에 포함하지 말 것.**
- `Backend/demo/` 폴더 자체는 dev에 남겨도 무해(실행형 스크립트). 정리하려면 롤백 후 삭제.
