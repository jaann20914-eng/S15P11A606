# 폴더 구조

```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
│   ├── _layout.tsx
│   └── login.tsx
├── (onboarding)/
│   ├── _layout.tsx
│   ├── age.tsx
│   ├── gender.tsx
│   ├── nickname.tsx
│   └── preferred-categories.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── home/
│   ├── recommend/
│   ├── write/
│   ├── chat/
│   └── mypage/
├── place/[placeId]/
├── pin/[pinId]/
├── pin-create/
└── chat-room/[roomId].tsx

src/
├── api/
├── hooks/
├── store/
├── components/
│   ├── common/
│   ├── home/
│   └── pin/
├── constants/
├── data/
└── types/
```

## 경계

- `app/`은 Expo Router 라우팅과 화면 조립을 담당한다.
- 공용 컴포넌트는 두 화면 이상에서 재사용할 때 `src/components/common/`에 둔다.
- 도메인 전용 컴포넌트는 `src/components/<domain>/`에 둔다.
- 색상, 간격, 반경, 타이포그래피는 `src/constants/theme.ts`를 통해 사용한다.
- 화면은 API URL을 직접 호출하지 않고 `src/api/`를 통해 접근한다.
- 실제 서버 상태 및 전역 상태 라이브러리는 백엔드 계약과 기술 선택이 확정된 뒤 연결한다.
