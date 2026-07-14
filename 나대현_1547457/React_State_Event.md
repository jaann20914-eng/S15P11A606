# 0713 학습일지 - 리액트 이벤트, State, 그리고 라우팅

## 들어가며

리액트의 활용을 위해서 정적인 뼈대인 컴포넌트와 Props에서 기능을 확장하여 웹 애플리케이션은 사용자의 클릭에 반응하고, 값이 변하며, 페이지가 전환되어야 한다. 오늘은 리액트에 생동감을 불어넣는 이벤트(Event)와 상태(State)의 원리를 파악하고, 여러 페이지를 제어하는 **React Router DOM**까지 확장하여 학습했다.

`생활코딩! React 리액트 프로그래밍` 교재를 중심으로 공부했다.

---

## 1. 정적 UI의 한계와 State의 필요성

Props는 부모가 전달하는 '읽기 전용' 데이터이기 때문에, 컴포넌트 내부에서 사용자의 입력에 따라 값을 바꿀 수 없다. 사용자의 상호작용에 따라 UI가 동적으로 변하려면 컴포넌트 스스로가 기억하고 관리하는 내부 데이터가 필요한데, 이를 State(상태)라고 한다.

```text
Props: 부모가 준 값 (외부 자극, 변경 불가능)
State: 컴포넌트 내부의 값 (내부 기억, 변경 가능 ──> UI 재렌더링 유발)

```

리액트는 일반 변수 값이 바뀐다고 해서 화면을 다시 그려주지 않는다. 반드시 리액트가 제공하는 `useState`를 통해 State를 변경해야만 변경 사항을 감지하고 화면을 새롭게 렌더링(Re-rendering)한다.

---

## 2. 핵심 개념 1: 이벤트와 State의 연동 원리

리액트에서 사용자의 행동(클릭, 입력 등)을 처리하는 **이벤트**와 값이 변하는 **State**는 바늘과 실처럼 움직인다.

### 이벤트-상태 순환 흐름

```text
사용자 클릭 (onClick 이벤트 발생)
        │
        ▼
이벤트 핸들러 함수 실행
        │
        ▼
State 변경 함수 호출 (setValue)
        │
        ▼
리액트가 변경 감지 후 컴포넌트 재실행 (재렌더링)

```

### 핵심 실습 코드

```jsx
import { useState } from 'react';

function Article(props) {
  return (
    <article>
      <h2>{props.title}</h2>
      {props.body}
    </article>
  );
}

function App() {
  // useState('기본값') -> [현재값, 변경함수] 반환
  const [mode, setMode] = useState('WELCOME');

  let content = null;
  if (mode === 'WELCOME') {
    content = <Article title="Welcome" body="Hello, Web" />;
  } else if (mode === 'READ') {
    content = <Article title="React" body="React is awesome!" />;
  }

  return (
    <div>
      {/* 1. 이벤트 안에서 State를 바꾸어 화면 전환을 유도 */}
      <a href="/" onClick={(event) => {
        event.preventDefault(); // 링크 이동 막기
        setMode('WELCOME');     // 상태를 WELCOME으로 변경
      }}>홈으로</a>

      <button onClick={() => setMode('READ')}>상세 보기</button>

      {/* 2. 현재 State에 따라 조건부로 렌더링되는 본문 */}
      {content}
    </div>
  );
}

```

* **`useState`**: 상태를 생성하는 리액트 훅(Hook)이다. 첫 번째 인자는 현재 상태 값(`mode`), 두 번째 인자는 상태를 바꾸는 함수(`setMode`)다.
* **`event.preventDefault()`**: HTML 태그의 기본 동작(예: `<a>` 태그의 페이지 새로고침)을 막고, 리액트 내부의 상태 전환 로직이 부드럽게 실행되도록 제어한다.

---

## 3. 핵심 개념 2: React Router DOM (페이지 라우팅)

State를 이용하면 한 페이지 안에서 UI를 동적으로 바꿀 수 있다. 하지만 주소창의 URL은 그대로 머물러 있기 때문에, 사용자가 특정 페이지를 북마크하거나 '뒤로 가기' 버튼을 누를 수 없다는 한계가 존재한다.

이 문제를 해결하고 **URL 경로(Path)에 따라 서로 다른 컴포넌트를 보여주도록 돕는 도구**가 바로 `react-router-dom`이다.

```text
단일 컴포넌트 조건문 (State 분기)
──> URL 고정, 새로고침 시 초기화

React Router DOM (주소 분기)
──> URL 변경 가능, 브라우저 뒤로가기/앞으로가기 지원

```

### 주요 컴포넌트의 역할

* **`BrowserRouter`**: 웹 애플리케이션에 라우팅 기능을 적용하기 위해 최상위 컴포넌트를 감싸는 통로다.
* **`Link`**: 일반 `<a>` 태그는 페이지 전체를 새로고침하지만, `Link` 컴포넌트는 필요한 부분만 부드럽게 바꿔주는 리액트 전용 링크다.
* **`Routes` & `Route**`: 현재 주소창의 경로(`path`)를 확인하고, 그에 매칭되는 컴포넌트(`element`)를 화면에 렌더링하는 스위치 역할을 한다.

---

## 4. 핵심 정리

```text
이벤트 (Event) ──> 사용자의 행동을 감지하고 로직을 트리거하는 장치
State ─────────> 컴포넌트의 생명주기 동안 유지되며 화면을 바꾸는 내부 변수
Router ────────> 주소창의 URL 경로와 컴포넌트를 매핑해주는 내비게이터

```

| 구분 | 관리 주체 | 화면 갱신(렌더링) 여부 | 주된 용도 |
| --- | --- | --- | --- |
| **Props** | 부모 컴포넌트 | 부모가 새 값을 줄 때만 갱신 | 자식에게 데이터 전달 |
| **State** | 컴포넌트 내부 | 상태 변경 함수 호출 시 즉시 갱신 | 내부 동적 데이터 관리 |
| **Router** | 브라우저 URL 패스 | 경로 매칭 시 해당 컴포넌트 갱신 | 멀티 페이지 구현 |

---
