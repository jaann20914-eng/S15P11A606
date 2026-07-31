import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { MapUnavailable } from './MapUnavailable';
import { KAKAO_MAP_BASE_URL, buildKakaoMapHtml } from './kakaoMapHtml';
import type { KakaoMapHandle, KakaoMapProps } from './KakaoMap.types';
import type { MapCommand, MapOutgoingMessage, MapPatch } from './kakaoMapHtml';
import { hasKakaoMapAppKey, kakaoMapAppKey } from '@/constants/env';
import { color, radius } from '@/constants/theme';

export type { KakaoMapHandle, KakaoMapProps } from './KakaoMap.types';

/**
 * 주입할 JS 리터럴을 만든다.
 * U+2028/2029는 JSON에서는 유효하지만 JS 소스에서는 줄바꿈이라 문자열을 깨뜨리므로 이스케이프한다.
 */
function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/[\u2028\u2029]/g, (char) =>
    char === '\u2028' ? '\\u2028' : '\\u2029',
  );
}

/**
 * 핀들의 한가운데. 최초 중심을 정하는 데만 쓴다.
 *
 * 정확한 영역은 지도가 준비된 뒤 `fitPlaces`가 잡으므로 여기서는 평균으로 충분하다.
 * 목적은 정확도가 아니라 **첫 타일을 올바른 동네에서 받는 것**이다.
 */
function centerOfPlaces(places: KakaoMapProps['places']): { latitude: number; longitude: number } {
  const total = places.reduce(
    (sum, place) => ({
      latitude: sum.latitude + place.latitude,
      longitude: sum.longitude + place.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return { latitude: total.latitude / places.length, longitude: total.longitude / places.length };
}

/**
 * 카카오맵 JavaScript SDK를 WebView 안에서 구동하는 지도.
 * SDK가 웹 전용이라 RN에서는 이 방식이 유일한 공식 경로다(네이티브 SDK는 Expo Go에서 못 쓴다).
 *
 * 터치는 전부 WebView 안의 SDK가 처리한다. RN 쪽에서 PanResponder 등으로 가로채면
 * 드래그·핀치가 끊기므로, 지도 위에 겹치는 요소는 `pointerEvents="box-none"`을 유지한다.
 *
 * 키가 없거나 SDK 로드에 실패하면 원인을 적은 안내 화면으로 대체된다.
 */
export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap(
  {
    places,
    filter,
    selectedPlaceId = null,
    center,
    fitPlacesOnReady = false,
    usePlaceSearch = false,
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
  },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** 다시 시도할 때 WebView를 새로 마운트하기 위한 key */
  const [attempt, setAttempt] = useState(0);
  const { width, height } = useWindowDimensions();

  /*
    최초 중심 좌표만 HTML에 심는다. 이후 이동은 명령으로 처리해 지도가 다시 로드되지 않게 한다.

    핀에 맞출 화면이라면 `center`가 아니라 핀들의 중심에서 시작한다. 그러지 않으면 첫 타일을
    엉뚱한 동네에서 받아 놓고 곧바로 버리게 된다 — 홈이 실제로 그랬다. 기본 중심은 서울숲인데
    핀은 영등포에 있어, 지도 한 화면을 통째로 받고 다시 받았다.
  */
  const initialCenter = useRef(fitPlacesOnReady && places.length > 0 ? centerOfPlaces(places) : center);
  const html = useMemo(
    () =>
      buildKakaoMapHtml({
        appKey: kakaoMapAppKey,
        center: initialCenter.current,
        usePlaceSearch,
      }),
    [usePlaceSearch],
  );

  const send = useCallback((method: MapCommand, args: unknown[] = []) => {
    webViewRef.current?.injectJavaScript(
      `window.WagleMap && window.WagleMap.${method}.apply(null, ${toScriptLiteral(args)}); true;`,
    );
  }, []);

  const patch = useMemo<MapPatch>(
    () => ({ places, filter, selectedPlaceId, myLocation }),
    [places, filter, selectedPlaceId, myLocation],
  );

  useEffect(() => {
    if (!ready) return;
    send('update', [patch]);
  }, [patch, ready, send]);

  /*
    필터가 바뀌어도 지도를 움직이지 않는다.

    예전에는 새 핀이 모두 보이도록 `fitPlaces`로 영역을 다시 잡았다. 그런데 혼잡도 토글은
    "여유한 곳만 / 붐비는 곳만 보기"라서, 지금 보고 있는 자리를 떠날 이유가 없다. 실제로는
    토글을 누를 때마다 내 위치에서 핀 묶음 전체로 화면이 끌려가 어디를 보고 있었는지 잃었다.

    핀은 `update` 패치로 다시 그려지므로 필터 결과는 그 자리에서 바로 반영된다.
  */

  // 화면 회전 등으로 WebView 크기가 바뀌면 SDK에 알려야 타일이 어긋나지 않는다.
  useEffect(() => {
    if (!ready) return;
    send('relayout');
  }, [width, height, ready, send]);

  // 가려진 하단만큼 마커를 위로 올려야 "보이는 화면의 중앙"에 놓인다.
  // 시트를 끌 때마다 지도가 다시 맞춰지지 않도록, 값은 ref로 읽고 effect 의존성에는 넣지 않는다.
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;

  useImperativeHandle(
    ref,
    () => ({
      panTo: ({ latitude, longitude }, options) =>
        send('panTo', [latitude, longitude, Math.round(insetRef.current / 2), options?.animate ?? true]),
      searchPlace: (keyword: string) => send('searchPlace', [keyword, Math.round(insetRef.current / 2)]),
      setLevel: (level: number) => send('setLevel', [level]),
      fitPlaces: () => send('fitPlaces', [insetRef.current]),
      relayout: () => send('relayout'),
    }),
    [send],
  );

  const fail = useCallback((reason: string) => {
    if (__DEV__) console.warn(`[KakaoMap] 지도를 불러오지 못했습니다: ${reason}`);
    setFailure(reason);
  }, []);

  const retry = useCallback(() => {
    setFailure(null);
    setReady(false);
    setAttempt((current) => current + 1);
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: MapOutgoingMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as MapOutgoingMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'ready':
          setReady(true);
          // 이미 핀 중심에서 시작했으므로 여기서의 맞춤은 확대만 손보는 짧은 보정이다.
          if (fitPlacesOnReady) send('fitPlaces', [insetRef.current]);
          onReady?.();
          break;
        case 'error':
          fail(message.reason);
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
    },
    [
      fail,
      fitPlacesOnReady,
      onMapPress,
      onPinPress,
      onPlaceNotFound,
      onPlaceResolved,
      onReady,
      onViewChange,
      send,
    ],
  );

  const reason = !hasKakaoMapAppKey ? 'missing-key' : failure;
  if (reason) {
    return (
      <MapUnavailable
        reason={reason}
        fullScreen={fullScreen}
        style={style}
        onRetry={hasKakaoMapAppKey ? retry : undefined}
      />
    );
  }

  return (
    <View style={[fullScreen ? s.fullMap : s.inlineMap, style]}>
      <WebView
        key={attempt}
        ref={webViewRef}
        source={{ html, baseUrl: KAKAO_MAP_BASE_URL }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onError={() => fail('webview-error')}
        style={s.webview}
        // 지도 드래그가 WebView 자체 스크롤/바운스와 겹치지 않게 한다. 터치 이벤트는 그대로 페이지로 전달된다.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        androidLayerType="hardware"
        cacheEnabled
      />
      {!ready && (
        <View pointerEvents="none" style={s.loading}>
          <ActivityIndicator color={color.pin.relaxed.strong} />
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  // 고정 height와 absoluteFill을 한 배열에 섞으면 height가 남아 전체화면이 깨진다. 두 스타일을 분리해 둔다.
  inlineMap: { height: 260, overflow: 'hidden', borderRadius: radius.hero, backgroundColor: color.bg.map },
  fullMap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: color.bg.map },
  webview: { flex: 1, backgroundColor: color.bg.map },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.map,
  },
});
