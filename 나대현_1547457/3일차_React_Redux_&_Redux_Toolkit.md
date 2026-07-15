# 0715 학습일지 - Redux & Redux Toolkit (RTK) 학습

## 1. Redux란?

Redux는 애플리케이션의 전역 상태를 하나의 Store에서 관리하는 라이브러리다.

Context API와는 다음 지점에서 다르다.

- Context API: 상태를 전달하는 도구
- Redux: 상태를 관리하고 변화를 추적하는 도구

주로 다음 목적으로 사용한다.

- 여러 컴포넌트에서 공유하는 전역 상태 관리
- 비동기 로직과 미들웨어 처리
- 상태 변화 추적과 디버깅

---

## 2. Context API 대신 Redux를 쓰는 이유

Context API는 값이 하나만 바뀌어도 구독 중인 컴포넌트가 전부 리렌더링된다.

```text
Context 값 변경
→ 구독 중인 컴포넌트 전체 리렌더링
```

Redux는 `useSelector`로 필요한 상태 조각만 구독한다.

```text
Redux 상태 변경
→ 해당 상태를 구독한 컴포넌트만 리렌더링
```

미들웨어도 차이가 있다.

```text
Context API
→ 비동기 처리, 로깅 등을 위한 별도 로직을 직접 구현해야 함

Redux
→ Redux-Thunk, Redux-Saga, redux-logger 같은 미들웨어를 액션 처리 파이프라인에 끼워 넣을 수 있음
```

디버깅 측면에서는 Redux DevTools로 상태 변화 스냅샷과 타임 트래블 디버깅이 가능하다.

---

## 3. Redux의 데이터 흐름

```text
View (이벤트 발생)
→ Action 객체 생성 (dispatch)
→ Middleware (비동기 처리, 로깅 등)
→ Reducer (이전 State + Action → 새로운 State)
→ Store (새 상태 저장, 구독 컴포넌트에 알림)
→ View (useSelector로 연결된 컴포넌트만 리렌더링)
```

데이터는 단방향으로만 흐른다. 이 구조를 Flux 패턴이라고 부른다.

---

## 4. Redux의 3대 원칙

```text
단일 진실 공급원
→ 전역 상태는 하나의 Store, 하나의 객체 트리에 저장

상태는 읽기 전용
→ 상태를 바꾸는 유일한 방법은 Action을 dispatch하는 것

Reducer는 순수 함수
→ 이전 상태와 Action을 받아 새로운 상태를 반환, 부수효과 없음
```

---

## 5. 기존 Redux의 문제 - 보일러플레이트

기능 하나를 추가하려면 Action Type 정의, Action Creator 작성, Reducer 작성이 각각 필요하다.

```text
Action Type 정의
→ Action Creator 작성
→ Initial State 정의
→ Reducer 작성 (switch-case)
```

코드량이 많아지고 파일이 흩어져서 어디서 뭘 바꿔야 하는지 추적하기 번거롭다. 이 문제를 해결하려고 나온 것이 Redux Toolkit(RTK)이다.

---

## 6. RTK가 해결하는 것

### createSlice

액션 타입, 액션 생성 함수, 리듀서를 한 번에 정의한다.

```javascript
import { createSlice } from '@reduxjs/toolkit';

const todoSlice = createSlice({
  name: 'todos',
  initialState: { items: [], status: 'idle' },
  reducers: {
    addTodo: (state, action) => {
      state.items.push({ id: Date.now(), text: action.payload, done: false });
    },
    toggleTodo: (state, action) => {
      const todo = state.items.find(item => item.id === action.payload);
      if (todo) todo.done = !todo.done;
    }
  }
});

export const { addTodo, toggleTodo } = todoSlice.actions;
export default todoSlice.reducer;
```

state.items.push()처럼 직접 수정하는 문법을 써도 내부적으로는 불변성이 유지된다.

```text
겉보기 코드
→ state를 직접 mutate하는 것처럼 보임

실제 동작
→ Immer가 내부에서 새 객체를 생성해서 불변성 유지
```

기존 Redux라면 다음처럼 스프레드 연산자로 직접 복사해야 했다.

```javascript
return {
  ...state,
  items: state.items.map(item =>
    item.id === action.payload ? { ...item, done: !item.done } : item
  )
};
```

### configureStore

미들웨어 설정, DevTools 연결 같은 초기 설정을 한 번에 처리한다.

```javascript
import { configureStore } from '@reduxjs/toolkit';
import todoReducer from '../features/todoSlice';

export const store = configureStore({
  reducer: { todos: todoReducer }
});
```

---

## 7. 컴포넌트 연결

```javascript
import { useSelector, useDispatch } from 'react-redux';
import { addTodo, toggleTodo } from './features/todoSlice';

function TodoApp() {
  const todos = useSelector(state => state.todos.items);
  const dispatch = useDispatch();

  return (
    <div>
      <button onClick={() => dispatch(addTodo('RTK 학습하기'))}>추가</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id} onClick={() => dispatch(toggleTodo(todo.id))}>
            {todo.text} {todo.done ? '완료' : '진행중'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`useSelector(state => state.todos.items)`는 items가 바뀔 때만 이 컴포넌트를 리렌더링한다. 다른 슬라이스 상태가 바뀌어도 영향받지 않는다.

---

## 8. Context API / Redux / RTK 비교

```text
코드 복잡도
Context API → 낮음
Redux (기존) → 높음, 액션/리듀서 분리 필요
RTK → 낮음, createSlice로 통합

성능 최적화
Context API → 수동 최적화 필요 (Context 분리 등)
Redux (기존) → Selector 단위 구독으로 우수
RTK → 동일하게 Selector 단위 구독

비동기 처리
Context API → useEffect 등 직접 구현
Redux (기존) → 미들웨어 설정 필요
RTK → createAsyncThunk 내장

적합한 규모
Context API → 중소규모, 정적 전역 데이터
Redux (기존) → 레거시 대형 프로젝트
RTK → 현재 신규 대형 프로젝트
```

---

## 9. 장점

```text
1. Selector 단위로 구독해서 불필요한 리렌더링을 줄인다.
2. 미들웨어로 비동기 처리, 로깅을 파이프라인에 끼워 넣을 수 있다.
3. Redux DevTools로 상태 변화와 타임 트래블 디버깅이 가능하다.
4. createSlice로 보일러플레이트를 줄일 수 있다.
5. Immer 덕분에 불변성 유지 코드를 신경 쓰지 않아도 된다.
```

---

## 10. 단점

```text
1. 작은 프로젝트에는 Store 설계 자체가 과할 수 있다.
2. Context API보다 초기 학습 곡선이 있다.
3. 상태를 어느 슬라이스에 둘지 설계가 필요하다.
4. 비동기 로직(createAsyncThunk)에 익숙해지는 데 시간이 걸린다.
```

---

## 11. 사용하기 좋은 경우

```text
여러 페이지/컴포넌트에서 같은 상태를 공유해야 하는 경우
비동기 요청 상태(로딩, 성공, 실패)를 체계적으로 관리해야 하는 경우
상태 변화를 추적하고 디버깅해야 하는 경우
프로젝트 규모가 커서 Context API로는 리렌더링 관리가 힘든 경우
```

단순히 부모-자식 간 값 전달이 필요한 정도라면 Context API만으로 충분할 수 있다.

---

## 12. 핵심 정리

```text
Store
→ 전역 상태를 저장하는 단일 객체 트리

Action
→ 상태 변화를 설명하는 객체, dispatch로 전달

Reducer
→ 이전 상태와 Action을 받아 새 상태를 반환하는 순수 함수

createSlice
→ Action Type, Action Creator, Reducer를 한 번에 정의

Immer
→ mutate하듯 작성해도 불변성을 유지해주는 내부 라이브러리

configureStore
→ 미들웨어, DevTools 설정을 단순화
```

전체 흐름은 다음과 같다.

```text
컴포넌트에서 dispatch 실행
→ Action 생성
→ Middleware 통과
→ Reducer가 새 상태 계산
→ Store에 저장
→ useSelector로 구독한 컴포넌트만 리렌더링
```