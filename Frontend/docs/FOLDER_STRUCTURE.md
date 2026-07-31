# 폴더 구조

**배치 규칙은 [`../README.md`](../README.md)의 "배치 규칙"에 있다.** 이 문서는 현재 파일 목록만 담는다.

## 라우트

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
│   ├── _layout.tsx            탭 순서·아이콘은 src/components/common/AppTabBar와 공유
│   ├── home/                  index, search
│   ├── chat/                  sent, received
│   ├── write/                 index
│   ├── recommend/             index
│   └── mypage/                index, activity, credits, edit-nickname
├── place/[placeId]/index.tsx
├── pin/[pinId]/index.tsx
├── pin-create/                camera, detail-form, ai-review, publishing
├── chat-room/[roomId].tsx
└── oauth/callback/[provider].tsx   App Link 복귀 주소. 처리는 useOAuthLogin이 한다
```

## 소스

```text
src/
├── features/
│   ├── auth/
│   │   └── hooks/             useOAuthLogin(로그인 흐름), useAuthSession(복원·세션 만료)
│   └── pin-detail/            /pin/[pinId] 전용
│       ├── components/        PinDetailHeader, PinDetailBody, OwnerMenu,
│       │                      PinPurchaseModal, PinChatRequestModal
│       ├── hooks/             usePinDetail, usePinDetailScreen
│       └── styles.ts
├── api/
│   ├── client.ts              axios 인스턴스·인터셉터·ApiError·401 재발급 재시도
│   ├── config.ts              usesMockApi
│   ├── auth/                  oauth, refresh
│   ├── pin/                   detail, unlock, evaluate, remove
│   └── chat/                  request, leave
├── mocks/                     pin, chat, auth
├── components/
│   ├── common/                ui, AppTabBar, ConfirmModal, ErrorView,
│   │                          ScreenContainer, ListGroup, CrowdFilterToggle,
│   │                          CrowdLevelBadge, ViewAvatar, modalAnimation
│   └── home/                  MapPlaceholder, MapMarker
├── hooks/                     useResponsivePadding
├── store/                     createStore, useMapStore, useAuthStore
├── types/                     common, pin, chat, place, auth, env.d.ts
├── constants/                 theme, crowdLevels, categories
├── utils/                     datetime, viewAngle, idempotency, navigation, oauth
└── data/                      mock.ts (목업 화면 하드코딩, API 연동 시 제거 예정)
```
