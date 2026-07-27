import { useSyncExternalStore } from 'react';

/**
 * `useSyncExternalStore` 기반의 최소 스토어 팩토리.
 * 상태 라이브러리(zustand)가 확정되면 `createStore` 구현만 교체할 수 있도록
 * API 모양(`useStore(selector)` / `getState` / `setState` / `subscribe`)을 zustand와 맞췄다.
 *
 * 셀렉터는 원시값이나 안정적인 참조를 반환해야 한다. 매 호출마다 새 객체를 만들면
 * 스냅샷 비교가 항상 실패해 리렌더가 반복된다.
 */

export type StateSetter<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
export type StateCreator<T> = (set: StateSetter<T>, get: () => T) => T;

export interface StoreApi<T> {
  getState: () => T;
  setState: StateSetter<T>;
  subscribe: (listener: () => void) => () => void;
}

export type UseBoundStore<T> = {
  (): T;
  <S>(selector: (state: T) => S): S;
} & StoreApi<T>;

export function createStore<T extends object>(initializer: StateCreator<T>): UseBoundStore<T> {
  const listeners = new Set<() => void>();

  const getState = (): T => state;

  const setState: StateSetter<T> = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    const changed = (Object.keys(next) as (keyof T)[]).some((key) => !Object.is(state[key], next[key]));
    if (!changed) return;

    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  let state: T = initializer(setState, getState);

  function useBoundStore<S>(selector?: (state: T) => S): S | T {
    const getSnapshot = (): S | T => (selector ? selector(getState()) : getState());
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  return Object.assign(useBoundStore, { getState, setState, subscribe }) as UseBoundStore<T>;
}
