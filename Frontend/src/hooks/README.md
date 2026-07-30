# 공용 훅

**여러 화면이 함께 쓰는 훅만** 둔다. 한 화면 전용 훅은 `src/features/{화면}/hooks/`에 둔다.

`useResponsivePadding`은 온보딩·홈·추천·장소 상세가 모두 쓰므로 여기 있고,
`usePinDetail`은 `/pin/[pinId]`만 쓰므로 `src/features/pin-detail/hooks/`에 있다.

`useNicknameCheck`은 지금은 마이페이지만 쓰지만 온보딩도 같은 중복 확인 규칙을 쓸 예정이라 여기 있다.
