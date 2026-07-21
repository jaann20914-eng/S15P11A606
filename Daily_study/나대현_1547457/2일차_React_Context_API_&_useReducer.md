# 0714 학습일지 - Context API & useReducer 챕터 학습

## 들어가며

프로젝트 규모가 커질수록 `useState`만으로는 컴포넌트 트리 깊숙이 데이터를 전달하거나(Prop Drilling), 복잡하게 얽힌 상태 변경 로직을 일관되게 관리하기 어려워진다. 오늘은 리액트의 선언적 상태 관리의 핵심인 **Context API**와 **useReducer**의 내부 동작 원리 및 렌더링 최적화 패턴을 깊이 있게 학습했다.

---

## 1. Context API: 전역 상태 공유의 메커니즘과 한계

### Prop Drilling의 본질적인 문제점

컴포넌트 하위 5단계 아래에 있는 컴포넌트에 상태를 전달하기 위해 중간의 4개 컴포넌트가 무의미하게 props를 받아 넘겨주는 현상이다.

* **유지보수 저하:** props의 이름이나 구조를 변경할 때 중간 컴포넌트의 코드를 모두 수정해야 한다.
* **불필요한 렌더링:** 중간 컴포넌트들은 해당 props를 직접 사용하지 않음에도, 부모 컴포넌트가 리렌더링될 때 함께 리렌더링되면서 성능 낭비가 발생한다.

### Context API의 동작 원리

Context API는 컴포넌트 트리 전체에 가상의 데이터 저장소를 두고, 필요한 컴포넌트가 직접 데이터를 구독하게 만든다.

```text
[일반적인 Props 전달]
App (State) ──> ParentA ──> ParentB ──> Child (성능 비효율)

[Context API 적용]
App (Context.Provider) ──(직접 구독)──> Child (ParentA, B는 렌더링 영향 없음)

```

### ⚠️ 최적화 시 주의할 점 (Context의 렌더링 전파)

Context Provider의 `value` 값이 변경되면, 해당 Context를 구독하는 **모든 하위 컴포넌트(useContext를 호출하는 컴포넌트)가 리렌더링**된다.

* 만약 하나의 Context에 여러 종류의 상태를 묶어서 전달하면, 특정 상태 하나만 변경되어도 엉뚱한 컴포넌트들까지 전부 재렌더링되는 성능 병목이 발생할 수 있다.
* **해결책:** 상태의 성격에 따라 Context를 쪼개거나, 뒤에서 다룰 **State와 Dispatch를 분리하는 패턴**을 적용해야 한다.

---

## 2. useReducer: 복잡한 상태 로직의 격리와 선언적 제어

`useState`는 상태를 바꿀 때 컴포넌트 내부에서 구체적인 계산 로직을 처리한다(명령형). 반면 `useReducer`는 컴포넌트 외부로 상태 변경 로직을 분리하고, 컴포넌트 내부에서는 "어떤 일이 일어났는지(Action)"만 선언적으로 알린다.

### useReducer의 핵심 3요소와 흐름

```text
[이벤트 발생] ──> dispatch(action) ──> [Reducer 함수 실행] ──> 새로운 State 반환 ──> UI 반영

```

1. **State:** 현재 컴포넌트가 가진 상태 객체.
2. **Action:** 상태를 어떻게 변경할지 담은 명세서 객체 (통상 `{ type: 'ACTION_NAME', payload: 데이터 }` 형태).
3. **Reducer:** 이전 `state`와 `action`을 인자로 받아 **새로운 state를 반환하는 함수**.

### Reducer 함수 작성 시 준수해야 할 2대 원칙

* **순수 함수(Pure Function)여야 한다:** 내부에서 `new Date()`나 네트워크 요청(API호출), 외부 변수 변경 같은 부수 효과(Side Effect)를 일으키면 안 된다. 동일한 입력값에는 항상 동일한 결과값을 반환해야 리액트가 상태 변화를 예측할 수 있다.
* **불변성(Immutability)을 지켜야 한다:** 기존 state 객체를 직접 수정(`state.count = 5`)하면 안 되며, 반드시 스프레드 연산자(`...`) 등을 사용해 **새로운 객체를 생성하여 반환**해야 리액트가 메모리 주소 비교를 통해 변화를 감지하고 렌더링을 수행한다.

---

## 3. 실전 패턴: Context API + useReducer 최적화 설계

가장 이상적인 구조는 상태를 읽는 Context(StateContext)와 상태를 바꾸는 함수를 보내는 Context(DispatchContext)를 분리하는 것이다. 이렇게 하면 상태가 변경되어도 Dispatch 기능만 가져다 쓰는 컴포넌트는 리렌더링되지 않는다.

```jsx
import React, { createContext, useContext, useReducer } from 'react';

// 1. 두 개의 Context 생성
const TodoStateContext = createContext(null);
const TodoDispatchContext = createContext(null);

// 2. Reducer 정의 (불변성 유지)
function todoReducer(state, action) {
  switch (action.type) {
    case 'CREATE':
      return [...state, { id: action.id, text: action.text, done: false }];
    case 'TOGGLE':
      return state.map(todo => todo.id === action.id ? { ...todo, done: !todo.done } : todo);
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}

// 3. Provider 컴포넌트 구현
export function TodoProvider({ children }) {
  const [state, dispatch] = useReducer(todoReducer, [
    { id: 1, text: '리액트 공부하기', done: true }
  ]);

  return (
    <TodoStateContext.Provider value={state}>
      <TodoDispatchContext.Provider value={dispatch}>
        {children}
      </TodoDispatchContext.Provider>
    </TodoStateContext.Provider>
  );
}

// 4. 컴포넌트에서 안전하게 꺼내 쓰기 위한 Custom Hooks
export function useTodoState() {
  const context = useContext(TodoStateContext);
  if (!context) throw new Error('Cannot find TodoProvider');
  return context;
}

export function useTodoDispatch() {
  const context = useContext(TodoDispatchContext);
  if (!context) throw new Error('Cannot find TodoProvider');
  return context;
}

```

---

## 4. 핵심 정리 및 비교

| 비교 항목 | useState | useReducer + Context API |
| --- | --- | --- |
| **상태 관리 위치** | 컴포넌트 내부 개별 관리 | 컴포넌트 외부(Reducer) 및 전역(Context) |
| **로직 가독성** | 단순한 상태 관리에 적합 | 복잡하고 상태 간 유기적 흐름이 많을 때 적합 |
| **의존성** | 컴포넌트 내부에 결합됨 | 상태 로직이 컴포넌트와 완벽히 분리되어 테스트 용이 |
| **렌더링 제어** | 상태 변경 시 해당 컴포넌트만 영향 | 설계에 따라 전역 렌더링 전파 가능 (분리 패턴 필수) |

---
