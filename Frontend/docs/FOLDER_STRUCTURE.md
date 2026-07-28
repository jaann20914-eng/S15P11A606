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
└── chat-room/[roomId].tsx
```

## 소스

```text
src/
├── features/
│   └── pin-detail/            /pin/[pinId] 전용
│       ├── components/        PinDetailHeader, PinDetailBody, OwnerMenu,
│       │                      PinPurchaseModal, PinChatRequestModal
│       ├── hooks/             usePinDetail, usePinDetailScreen
│       └── styles.ts
├── api/
│   ├── client.ts              axios 인스턴스·인터셉터·ApiError
│   ├── config.ts              usesMockApi
│   ├── pin/                   detail, unlock, remove
│   └── chat/                  leave
├── mocks/                     pin, chat
├── components/
│   ├── common/                ui, AppTabBar, ConfirmModal, ErrorView,
│   │                          ScreenContainer, ListGroup, CrowdFilterToggle,
│   │                          CrowdLevelBadge, ViewAvatar, modalAnimation
│   └── home/                  MapPlaceholder, MapMarker
├── hooks/                     useResponsivePadding
├── store/                     createStore, useMapStore
├── types/                     common, pin, place, env.d.ts
├── constants/                 theme, crowdLevels, categories
├── utils/                     datetime, viewAngle, idempotency, navigation
└── data/                      mock.ts (목업 화면 하드코딩, API 연동 시 제거 예정)
```
