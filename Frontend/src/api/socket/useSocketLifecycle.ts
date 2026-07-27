import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { socketClient } from './client';
import type { MessageHandler, SocketStatus, TokenProvider } from './client';

/**
 * 소켓 연결을 앱 수명주기에 붙인다. 루트 레이아웃에서 한 번만 호출한다.
 *
 * @param isLoggedIn 로그인 상태. false가 되면 연결을 끊는다.
 * @param getToken   액세스 토큰을 반환한다. 재연결 때마다 다시 호출되므로 최신 값을 돌려줘야 한다.
 */
export function useSocketLifecycle(isLoggedIn: boolean, getToken: TokenProvider): void {
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    useEffect(() => {
        if (!isLoggedIn) {
            void socketClient.disconnect();
            return;
        }

        const provideToken: TokenProvider = () => getTokenRef.current();
        socketClient.connect(provideToken);

        // 백그라운드에 있는 동안 OS가 소켓을 끊어도 앱은 모를 수 있다.
        // 복귀 시 한 번 더 붙여준다. 이미 연결돼 있으면 아무 일도 일어나지 않는다.
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') socketClient.connect(provideToken);
        });

        return () => {
            subscription.remove();
            void socketClient.disconnect();
        };
    }, [isLoggedIn]);
}

/** 현재 연결 상태. 재연결 배너 등에 쓴다. */
export function useSocketStatus(): SocketStatus {
    return useSyncExternalStore(
        (onStoreChange) => socketClient.onStatusChange(onStoreChange),
        () => socketClient.getStatus(),
        () => socketClient.getStatus(),
    );
}

/**
 * destination 구독을 컴포넌트 수명에 맞춘다.
 * 연결 전에 호출해도 되며, 연결·재연결 시점에 자동으로 다시 걸린다.
 *
 * `handler`는 ref로 최신 값을 유지하므로 `useCallback`으로 감쌀 필요가 없다.
 * 매 렌더마다 구독을 끊었다 다시 걸면 그 사이 도착한 메시지를 놓치기 때문이다.
 */
export function useSocketSubscription(destination: string, handler: MessageHandler): void {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        return socketClient.subscribe(destination, (body, message) => {
            handlerRef.current(body, message);
        });
    }, [destination]);
}
