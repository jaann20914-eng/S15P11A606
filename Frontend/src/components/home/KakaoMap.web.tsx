// 이 파일을 import 하는 곳은 없지만 지우면 안 된다.
// Metro가 웹 플랫폼에서 `KakaoMap.tsx` 대신 `.web.tsx`를 자동으로 선택한다(플랫폼 확장자 규칙).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapUnavailable } from './MapUnavailable';
import { buildKakaoMapHtml, serializeMapCommand } from './kakaoMapHtml';
import type { KakaoMapHandle, KakaoMapProps } from './KakaoMap.types';
import type { MapCommand, MapOutgoingMessage, MapPatch } from './kakaoMapHtml';
import { hasKakaoMapAppKey, kakaoMapAppKey } from '@/constants/env';
import { color, radius } from '@/constants/theme';

export type { KakaoMapHandle, KakaoMapProps } from './KakaoMap.types';

/**
 * 웹 구현. `react-native-webview`는 웹을 지원하지 않으므로 같은 HTML을 iframe(srcDoc)으로 띄우고
 * `postMessage`로 네이티브와 동일한 프로토콜을 주고받는다.
 */
export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap(
  {
    places,
    filter,
    selectedPlaceId = null,
    center,
    myLocation = null,
    fullScreen = false,
    bottomInset = 0,
    style,
    onPinPress,
    onMapPress,
    onViewChange,
    onReady,
    onPlaceResolved,
    onPlaceNotFound,
    // 웹은 iframe이라 최초 중심 최적화(fitPlacesOnReady)의 이득이 없다. 받기만 하고 쓰지 않는다.
    usePlaceSearch = false,
  },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const initialCenter = useRef(center);
  const html = useMemo(
    () => buildKakaoMapHtml({ appKey: kakaoMapAppKey, center: initialCenter.current, usePlaceSearch }),
    [usePlaceSearch],
  );

  const send = useCallback((method: MapCommand, ...args: unknown[]) => {
    frameRef.current?.contentWindow?.postMessage(serializeMapCommand(method, ...args), '*');
  }, []);

  const patch = useMemo<MapPatch>(
    () => ({ places, filter, selectedPlaceId, myLocation }),
    [places, filter, selectedPlaceId, myLocation],
  );

  useEffect(() => {
    if (!ready) return;
    send('update', patch);
  }, [patch, ready, send]);

  // 필터가 바뀌면 핀 묶음 자체가 달라지므로 새 핀이 모두 보이도록 영역을 다시 잡는다.
  // 첫 실행(지도 준비 시점)은 건너뛴다. 화면이 지정한 최초 중심을 덮어써 버리기 때문이다.
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!fittedOnce.current) {
      fittedOnce.current = true;
      return;
    }
    send('fitPlaces', insetRef.current);
  }, [filter, ready, send]);

  // 가려진 하단만큼 마커를 위로 올려야 "보이는 화면의 중앙"에 놓인다.
  // 시트를 끌 때마다 지도가 다시 맞춰지지 않도록, 값은 ref로 읽고 effect 의존성에는 넣지 않는다.
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;

  useImperativeHandle(
    ref,
    () => ({
      panTo: ({ latitude, longitude }, options) =>
        send('panTo', latitude, longitude, Math.round(insetRef.current / 2), options?.animate ?? true),
      searchPlace: (keyword: string) => send('searchPlace', keyword, Math.round(insetRef.current / 2)),
      setLevel: (level: number) => send('setLevel', level),
      fitPlaces: () => send('fitPlaces', insetRef.current),
      relayout: () => send('relayout'),
    }),
    [send],
  );

  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;

      let message: MapOutgoingMessage;
      try {
        message = JSON.parse(String(event.data)) as MapOutgoingMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'ready':
          setReady(true);
          onReady?.();
          break;
        case 'error':
          if (__DEV__) console.warn(`[KakaoMap] 지도를 불러오지 못했습니다: ${message.reason}`);
          setFailure(message.reason);
          break;
        case 'pinPress':
          onPinPress?.(message.placeId);
          break;
        case 'mapPress':
          onMapPress?.();
          break;
        case 'idle':
          onViewChange?.(message.view);
          break;
        case 'placeResolved':
          onPlaceResolved?.(message.place);
          break;
        case 'placeNotFound':
          onPlaceNotFound?.(message.keyword, message.reason);
          break;
      }
    };

    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onMapPress, onPinPress, onPlaceNotFound, onPlaceResolved, onReady, onViewChange]);

  const reason = !hasKakaoMapAppKey ? 'missing-key' : failure;
  if (reason) {
    return (
      <MapUnavailable
        reason={reason}
        fullScreen={fullScreen}
        style={style}
        onRetry={
          hasKakaoMapAppKey
            ? () => {
                setFailure(null);
                setReady(false);
                setAttempt((current) => current + 1);
              }
            : undefined
        }
      />
    );
  }

  return (
    <View style={[fullScreen ? s.fullMap : s.inlineMap, style]}>
      <iframe
        key={attempt}
        ref={frameRef}
        title="와글와글 지도"
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
});

const s = StyleSheet.create({
  // 고정 height와 absoluteFill을 한 배열에 섞으면 height가 남아 전체화면이 깨진다. 두 스타일을 분리해 둔다.
  inlineMap: { height: 260, overflow: 'hidden', borderRadius: radius.hero, backgroundColor: color.bg.map },
  fullMap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: color.bg.map },
});
