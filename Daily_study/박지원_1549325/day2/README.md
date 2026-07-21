# 학습일지 — 프론트엔드 아키텍처 (React 기준)

**날짜**: 2026-07-14
**주제**: 프론트엔드 아키텍처 3대 축 (컴포넌트 배치 / 상태관리 / 폴더구조) + Axios·TanStack Query 조합

---

## 오늘의 핵심 질문
> "React 프로젝트를 현업에 가깝게 구성하려면 무엇을, 어떤 기준으로 선택해야 하는가?"

결론부터: 프론트엔드 아키텍처는 하나의 정답이 아니라 **3개의 독립적인 축**으로 나뉘고, 각 축에서 선택지를 조합해서 프로젝트 구조를 완성한다.

```
프론트엔드 아키텍처
├── 1. 컴포넌트/파일 배치 전략   (파일을 어디에 놓을까)
├── 2. 데이터 흐름/상태관리 패턴  (상태를 어떻게 다룰까)
└── 3. 폴더/도메인 구조 방법론   (전체를 어떤 기준으로 나눌까)
```

---

## 1. 컴포넌트/파일 배치 전략

| 방식 | 핵심 | 비고 |
|---|---|---|
| **Atomic Design** | `atoms → molecules → organisms → templates → pages` | 디자인 시스템 구축 시 유용 |
| **Colocation** | 관련 파일을 물리적으로 가까이 배치 (`_components`, `_hooks`) | Next.js App Router가 권장하는 방식 |
| **Type-based Structure** | `components/`, `hooks/`, `utils/`로 파일 종류별 분리 | 전통적 방식, 프로젝트 커지면 파일이 흩어지는 문제 → 요즘은 지양 |

---

## 2️. 데이터 흐름 / 상태관리 패턴

### 발전 흐름 한눈에 보기
```
Flux (2014, 개념)
  ↓
Redux (2015, 구현체)
  ↓
Redux Toolkit (2019, 보일러플레이트 해소) ─┐
Recoil / Jotai (2020~, atom 단위 세분화)  ├─ Client State 담당
Zustand (2019~, 경량 대안)               ─┘
  +
TanStack Query / SWR (2019~) → Server State는 별개 문제라는 인식 확산
  ↓
현재: Server State / Client State 분리가 표준
```

### 1) Flux
- Facebook이 2014년 채팅 알림 버그 해결을 위해 고안한 **원조 단방향 데이터 흐름 패턴**
- 흐름: `Action → Dispatcher → Store → View`
- 핵심 철학: View가 Store를 직접 수정하지 못하게 막아 **추적 가능성 확보**
- 현재는 그대로 쓰이지 않고 Redux가 계승

### 2) Redux (Flux의 구현체)
- Dispatcher 제거 + **단일 스토어 + 순수 함수 리듀서**로 단순화
- 특징: 불변성 강제(새 객체 반환) → 시간여행 디버깅 가능 / 예측 가능성 높음 / 보일러플레이트 多
```js
function cartReducer(state = [], action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return [...state, action.payload];
    default:
      return state;
  }
}
```
- **Redux Toolkit(RTK)**: Immer 내장 → 직접 수정하는 것처럼 써도 내부적으로 불변성 자동 처리. 현재 "Redux"는 사실상 RTK를 의미.

### 3) MVVM (Vue/Angular 계열)
- `Model - View - ViewModel`, 핵심은 **양방향 바인딩** (`v-model`)
- React는 단방향 철학(`useState` + `onChange`)이라 엄밀히는 MVVM을 쓰지 않음
- 다만 **커스텀 훅이 ViewModel과 유사한 역할**을 한다는 비유로 언급됨

### 4) Atomic State (Recoil, Jotai)
- 하나의 거대한 스토어 대신 상태를 **atom 단위**로 쪼갬
```js
const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);
```
- 장점: 세분화된 리렌더링 / 보일러플레이트 최소화 / `useState`와 유사한 낮은 러닝커브
- 한계: atom 간 의존 관계가 복잡해지면 오히려 구조가 흩어질 수 있음 → 국소적 전역 상태에 적합

### 5) Server State vs Client State 분리 패턴 
- 핵심 통찰: **서버 데이터**와 **클라이언트 전용 상태**는 본질이 다른데, 예전엔 둘 다 Redux에 욱여넣었음

| | Server State | Client State |
|---|---|---|
| 예시 | API로 받은 상품 목록 | 모달 열림 여부, 폼 값 |
| 원본 소유 | 서버 | 클라이언트 |
| 필요 처리 | 캐싱/리페칭/만료 관리 | 단순 저장/변경 |

- 해결책: **TanStack Query / SWR**(서버 상태) + **Zustand/Redux/Jotai**(클라이언트 상태) 분리
```js
const { data, isLoading, error } = useQuery({
  queryKey: ['products'],
  queryFn: () => fetch('/api/products').then(res => res.json()),
  staleTime: 1000 * 60,
});
```
→ **현재 React 현업에서 가장 표준적인 조합**

---

## 3️. 폴더 / 도메인 구조 방법론

| 방식 | 핵심 | 비고 |
|---|---|---|
| MVC | Model-View-Controller | 현재 React에선 거의 안 씀 |
| Layered Architecture | Presentation-Business Logic-Data Access 수평 분할 | 백엔드에서 유래 |
| **FBS** (Feature-Based) | 기능 단위 느슨한 분리 | 공식 규칙 없음, 팀 재량 |
| **FSD** (Feature-Sliced Design) | `app/pages/widgets/features/entities/shared` + 단방향 의존성 규칙 공식화 | **현재 React 현업 트렌드 중심** |
| DDD 기반 구조 | 도메인(User, Order) 중심 폴더링 | FSD의 entities 레이어와 사상 유사 |
| Micro Frontend | 앱을 독립 배포 가능한 서브 앱으로 분할 | 초대형/멀티팀 환경 |

**FSD 핵심 규칙 3가지**
1. 의존성은 위→아래로만 (`pages → features → entities → shared`)
2. 각 슬라이스는 `index.ts`(public API)로만 외부 노출
3. `shared`는 어떤 도메인 지식도 몰라야 함

---

## 4️. Axios + TanStack Query 조합

### 역할 구분
| | Axios | TanStack Query |
|---|---|---|
| 역할 | **HTTP 통신** 그 자체 | 통신을 **언제·어떻게 실행할지** 관리 |
| 담당 | 요청/응답 | 캐싱, 자동 리페칭, 로딩/에러 상태, 중복 요청 방지 |

> Axios가 실행하는 함수(`queryFn`)를 TanStack Query가 감싸서 관리하는 구조

### 흐름도
```
[컴포넌트] → useProducts() 호출
     ▼
[TanStack Query] → queryKey로 캐시 확인
     ▼ (캐시 없음/만료)
[queryFn 실행] → Axios 함수(getProducts)
     ▼
[Axios] → 실제 HTTP 요청 → 서버
     ▼
[응답] → 캐시 저장 + 컴포넌트에 data 전달
     ▼
[컴포넌트 리렌더링] → data, isLoading, isError 자동 관리
```

### FSD 구조에 적용
```
features/products/
├── api/
│   └── productApi.js       # Axios 함수 (순수 통신)
├── model/
│   ├── useProducts.js      # useQuery 훅
│   └── useCreateProduct.js # useMutation 훅
├── ui/
│   └── ProductList.jsx     # 컴포넌트 (훅만 호출)
└── index.js                 # public API export
```
→ 통신(api) / 상태관리(model) / 화면(ui)이 완전히 분리되어, API가 바뀌어도 `ui` 레이어는 건드릴 필요 없음
