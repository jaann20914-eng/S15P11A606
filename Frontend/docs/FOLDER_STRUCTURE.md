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

assets/          # 화면에서 require 하는 이미지
deliverables/    # 브랜드 가이드 등 디자인 산출물 (앱 실행과 무관)
docs/            # 설계 문서
```

## 실행에 필요한 것과 아닌 것

앱 실행에 필요한 것은 `app/`, `src/`, `assets/`, 그리고 루트 설정 파일(`app.json`, `package.json`,
`tsconfig.json`, `.env`)뿐이다. `docs/`, `deliverables/`, `DESIGN_GUIDE.md`는 문서·산출물이라
없어도 앱은 동작한다.

`assets/`에는 아직 화면에 연결되지 않은 이미지도 있다(뷰포인트용 `view-angles/` 등).
Metro는 `require` 되지 않은 파일을 번들에 넣지 않으므로 앱 용량에는 영향이 없다.

## 지우면 안 되는 파일

- `src/components/home/KakaoMap.web.tsx` — `import` 구문에 나타나지 않지만 Metro가 웹 플랫폼에서
  `KakaoMap.tsx` 대신 자동으로 선택한다. 참조가 없어 보여도 삭제하면 웹 빌드가 깨진다.
- `src/api/client.ts`, `src/types/place.ts`, `src/types/pin.ts` — 아직 호출되지 않지만
  백엔드 연동이 들어올 자리다.

## 경계

- `app/`은 Expo Router 라우팅과 화면 조립을 담당한다.
- 공용 컴포넌트는 두 화면 이상에서 재사용할 때 `src/components/common/`에 둔다.
- 도메인 전용 컴포넌트는 `src/components/<domain>/`에 둔다.
- 색상, 간격, 반경, 타이포그래피는 `src/constants/theme.ts`를 통해 사용한다.
- 화면은 API URL을 직접 호출하지 않고 `src/api/`를 통해 접근한다.
- 실제 서버 상태 및 전역 상태 라이브러리는 백엔드 계약과 기술 선택이 확정된 뒤 연결한다.
