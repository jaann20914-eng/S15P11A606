# 시연용 임시 변경 — 롤백 참조

- 기준 브랜치: `fix/backend/pins-location-update` (dev 머지)
- 데모 커밋(Java 변경 반영): `444f34b [Back] fix: 시연용 수정`
- 컨테이너: 백엔드 `waggle-backend`, DB `waggle-postgis` (DB명 `wagglewaggle`, 유저 `waggle`)

**최종 방침:** Java 로직은 **원본으로 되돌렸다.** 시연은 **원본 로직 그대로 두고, 더미 데이터를 시연 직전에 넣는 방식**만 사용한다.

---

## A. 코드 변경 — 되돌림 완료 (작업트리 기준)

`444f34b` 에 들어갔던 아래 4곳의 `[DEMO]` 변경을 **모두 원래 값으로 원복함**(작업트리). `grep -rn "\[DEMO\]" Backend/src` → 결과 없음.

| 파일 | 상수 | 데모값(되돌리기 전) | 원복값(현재) |
|------|------|------|------|
| `place/service/PlacePinService.java` | `ACTIVE_WINDOW` | `Duration.ofDays(8)` | `Duration.ofHours(1)` |
| `place/service/PlaceDetailService.java` | `ACTIVE_WINDOW` | `Duration.ofDays(8)` | `Duration.ofHours(1)` |
| `recommendation/service/AiCandidateAssembler.java` | `ACTIVE_VIDEO_TTL` | `Duration.ofDays(7)` | `Duration.ofHours(1)` |
| `place/service/PlacePinServiceTest.java` | 윈도우 단언값 | `Duration.ofDays(8)` | `Duration.ofHours(1)` |

### 원복을 실제로 반영(배포)하는 절차 — 남은 작업
1. 이 원복(작업트리 변경)을 커밋 → dev 에 머지 (커밋 메시지 예: `[Back] revert: 시연용 수정 원복`)
2. Jenkins 재배포로 `waggle-backend` 갱신
3. `./gradlew clean test` 는 CI에서 자동 실행됨(아래 B의 테스트는 로컬에서 이미 통과 확인)

---

## B. DB 더미 데이터 (배포와 무관, 즉시 반영) — 시연 직전 실행

`Backend/demo/` SQL. **원본 1시간 로직에 맞춰 "방금 등록된 실제 핀"처럼 넣는다(약 1시간 노출).**

| 스크립트 | 내용 | 식별자 |
|----------|------|--------|
| `01_setup.sql` | 실제 카카오 음식점 15곳 place(없으면 생성) + pin 15개 INSERT. `created_at` 1~15분 전 흩뿌림, `expires_at = now()+1h`, blur/썸네일 key 복사 | pin: `original_video_key LIKE 'demo/%'` / place: 15개 실제 kakao_place_id 중 "데모가 새로 만든 고아 행"만 |
| `02_hero_pin.sql` | 직접 촬영한 히어로 핀(하루 전 업로드 등)을 id로 지정해 `created_at=now`, `expires_at=now()+1h`로 되살림 | id 직접 지정(1단계 SELECT로 확인) |

> 실제 kakao_place_id 라 지도 주소·전화가 정상 표시됨. `expires_at`·`created_at`이 원본 TTL(1h)과 일치하므로
> AI에 보내는 활성화시각도 ≈now 로 정상. **1시간만 노출되므로 시연 직전에 실행하고, 길어지면 재실행.**

### DB 원복
```bash
docker exec -i waggle-postgis psql -U waggle -d wagglewaggle < Backend/demo/99_rollback.sql
```
- 데모 핀(`original_video_key LIKE 'demo/%'`) 삭제 + 데모가 새로 만든 고아 장소만 삭제.
- `99_rollback.sql` 의 `SETUP_DATE` 를 세팅한 날짜로 맞출 것.
- 직접 촬영한 히어로 핀은 실제 촬영본이라 자동 삭제 안 함 → 1시간 뒤 자연 만료되거나 앱에서 삭제.

---

## C. 주의
- `Backend/.claude/` 는 시연 작업과 무관한 untracked 파일 — **dev 머지에 포함하지 말 것.**
- `Backend/demo/` 폴더는 dev에 남겨도 무해. 정리하려면 삭제.
