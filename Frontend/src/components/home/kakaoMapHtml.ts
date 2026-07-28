import { color } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';

/**
 * 카카오맵 JavaScript SDK는 웹 전용이라 RN에서는 WebView(네이티브) / iframe(웹) 안에서 실행한다.
 * 이 파일은 그 안에 주입할 단일 HTML 문서를 만든다.
 *
 * - RN → 지도: `window.WagleMap.{update,panTo,relayout}` 호출 (네이티브는 injectJavaScript, 웹은 postMessage)
 * - 지도 → RN: `postToHost`가 `MapOutgoingMessage`를 JSON 문자열로 전달
 */

export interface MapPlaceMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface MapViewState {
  latitude: number;
  longitude: number;
  /** 남서/북동 좌표. 목록 조회의 bounds 쿼리에 그대로 쓴다. */
  bounds: { swLat: number; swLng: number; neLat: number; neLng: number };
  level: number;
}

/** 키워드 검색으로 찾은 장소. 백엔드가 좌표를 주기 전까지 상세 화면이 이 값으로 지도를 맞춘다. */
export interface ResolvedPlace {
  name: string;
  address: string;
  roadAddress: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export type MapOutgoingMessage =
  | { type: 'ready' }
  | { type: 'error'; reason: string }
  | { type: 'pinPress'; placeId: string }
  | { type: 'mapPress' }
  | { type: 'idle'; view: MapViewState }
  | { type: 'placeResolved'; place: ResolvedPlace }
  | { type: 'placeNotFound'; keyword: string; reason: 'no-result' | 'search-failed' };

export interface MapPatch {
  places?: MapPlaceMarker[];
  filter?: CrowdFilter;
  selectedPlaceId?: string | null;
  myLocation?: { latitude: number; longitude: number } | null;
}

/** WebView 안에서 SDK를 불러올 때 Referer로 쓰이는 도메인. 카카오 콘솔에 등록해야 한다. */
export const KAKAO_MAP_BASE_URL = 'https://localhost';

/** 지도 최초 확대 레벨. 숫자가 작을수록 확대된다(카카오 기준 1~14). */
export const DEFAULT_MAP_LEVEL = 5;

const pinTone: Record<CrowdFilter, { fill: string; ring: string }> = {
  relaxed: { fill: color.pin.relaxed.strong, ring: color.pin.relaxed.soft },
  wagle: { fill: color.pin.wagle.strong, ring: color.pin.wagle.soft },
};

export interface KakaoMapHtmlOptions {
  appKey: string;
  center: { latitude: number; longitude: number };
  level?: number;
}

export function buildKakaoMapHtml({
  appKey,
  center,
  level = DEFAULT_MAP_LEVEL,
}: KakaoMapHtmlOptions): string {
  const initial = JSON.stringify({
    lat: center.latitude,
    lng: center.longitude,
    level,
    tone: pinTone,
    location: {
      dot: color.location.me,
      border: color.location.meBorder,
      pulse: color.location.mePulse,
    },
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<!--
  문서 전체에 no-referrer를 걸면 안 된다.
  SDK 파일(sdk.js)만 Referer 없이 받고(도메인 등록 없이도 지도가 뜨도록), 그 위에서 도는
  services 검색 호출은 정상적으로 Referer를 보내야 카카오의 도메인 검사를 통과할 수 있다.
  그래서 no-referrer는 sdk.js를 넣는 script 엘리먼트에만 건다(아래 참고).
-->
<style>
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
    background: ${color.bg.map};
    /* 모바일 WebView에서 지도 드래그가 페이지 스크롤·당겨서 새로고침으로 새지 않도록 막는다. */
    overscroll-behavior: none;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  #map { width: 100%; height: 100%; }
  /*
   * 핀은 순수 표시 요소다. 오버레이 레이어가 지도 드래그 레이어 위에 있어서 핀이 터치를 받으면
   * 핀에서 시작한 드래그가 지도로 전달되지 않는다. 이벤트를 전부 지도로 흘려보내고,
   * 탭 판정은 지도 click 좌표를 핀 위치와 비교해서 처리한다(hitTestPlace).
   */
  .pin { pointer-events: none; -webkit-tap-highlight-color: transparent; }
  .pin-circle {
    width: 34px; height: 34px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 8px rgba(40, 38, 38, 0.28);
  }
  .pin-circle::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
  .pin-drop { filter: drop-shadow(0 4px 8px rgba(40, 38, 38, 0.3)); display: block; }
  .me { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .me::after { content: ''; width: 12px; height: 12px; border-radius: 50%; box-sizing: content-box; }
  .me-pulse { animation: mePulse 2s ease-out infinite; }
  @keyframes mePulse { 0% { transform: scale(0.7); opacity: 0.9; } 70% { transform: scale(1.35); opacity: 0.15; } 100% { transform: scale(0.7); opacity: 0.9; } }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var INITIAL = ${initial};

  function postToHost(message) {
    var payload = JSON.stringify(message);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  }

  var map = null;
  var overlays = [];
  var meOverlay = null;
  var state = { places: [], filter: 'relaxed', selectedPlaceId: null, myLocation: null };
  /** 핀이 도착하기 전에 들어온 fitPlaces 요청. 첫 렌더 직후 처리한다. */
  var pendingFitInset = null;

  function toneOf(filter) {
    return INITIAL.tone[filter] || INITIAL.tone.relaxed;
  }

  function circleElement(tone) {
    var el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = '<div class="pin-circle" style="background:' + tone.ring + ';border:3px solid ' + tone.fill + '"></div>';
    return el;
  }

  function dropElement(tone) {
    var el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML =
      '<svg class="pin-drop" width="42" height="54" viewBox="0 0 42 54" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M21 53C21 53 39 31.5 39 19.6C39 9.3 30.9 1 21 1C11.1 1 3 9.3 3 19.6C3 31.5 21 53 21 53Z" fill="' + tone.fill + '"/>' +
      '<circle cx="21" cy="19.6" r="7.6" fill="#ffffff"/>' +
      '</svg>';
    return el;
  }

  function meElement() {
    var el = document.createElement('div');
    el.className = 'me me-pulse';
    el.style.background = INITIAL.location.pulse;
    el.innerHTML = '<div style="width:12px;height:12px;border-radius:50%;background:' + INITIAL.location.dot + ';border:2px solid ' + INITIAL.location.border + '"></div>';
    return el;
  }

  function clearOverlays() {
    for (var i = 0; i < overlays.length; i += 1) overlays[i].setMap(null);
    overlays = [];
  }

  function renderPlaces() {
    if (!map) return;
    clearOverlays();
    var tone = toneOf(state.filter);

    for (var i = 0; i < state.places.length; i += 1) {
      var place = state.places[i];
      var selected = place.id === state.selectedPlaceId;
      var element = selected ? dropElement(tone) : circleElement(tone);
      element.setAttribute('aria-label', place.name);

      var overlay = new kakao.maps.CustomOverlay({
        map: map,
        position: new kakao.maps.LatLng(place.latitude, place.longitude),
        content: element,
        yAnchor: selected ? 1 : 0.5,
        xAnchor: 0.5,
        // 선택된 핀이 항상 위로 오도록
        zIndex: selected ? 20 : 10,
        clickable: false
      });
      overlays.push(overlay);
    }

    if (pendingFitInset !== null && state.places.length > 0) {
      var inset = pendingFitInset;
      pendingFitInset = null;
      fitToPlaces(inset);
    }
  }

  /** 중심 좌표를 화면 중앙(가려진 하단을 제외한 영역의 중앙)에 놓는다. */
  function centerOn(latLng, liftPx) {
    map.setCenter(latLng);
    if (!liftPx) return;

    // panBy는 이 버전에서 동작하지 않아, 중심을 liftPx만큼 아래 좌표로 옮겨 같은 효과를 낸다.
    var projection = map.getProjection();
    var point = projection.containerPointFromCoords(latLng);
    map.setCenter(projection.coordsFromContainerPoint(new kakao.maps.Point(point.x, point.y + liftPx)));
  }

  function fitToPlaces(bottomInsetPx) {
    var inset = bottomInsetPx || 0;

    // 한 곳뿐이면 영역 맞추기가 최대 확대로 튀므로 중심 이동으로 처리한다.
    if (state.places.length === 1) {
      var only = state.places[0];
      // 확대 레벨을 먼저 맞춘다. 중심 보정은 픽셀 기준이라 나중에 줌이 바뀌면 어긋난다.
      map.setLevel(${level});
      centerOn(new kakao.maps.LatLng(only.latitude, only.longitude), Math.round(inset / 2));
      return;
    }

    var bounds = new kakao.maps.LatLngBounds();
    for (var i = 0; i < state.places.length; i += 1) {
      bounds.extend(new kakao.maps.LatLng(state.places[i].latitude, state.places[i].longitude));
    }
    // 바텀시트에 가리는 만큼 아래쪽 여백을 더 줘서 핀이 시트 뒤로 숨지 않게 한다.
    map.setBounds(bounds, 96, 72, 96 + inset, 72);
  }

  function renderMyLocation() {
    if (!map) return;
    if (!state.myLocation) {
      if (meOverlay) { meOverlay.setMap(null); meOverlay = null; }
      return;
    }
    var position = new kakao.maps.LatLng(state.myLocation.latitude, state.myLocation.longitude);
    if (meOverlay) {
      meOverlay.setPosition(position);
      return;
    }
    meOverlay = new kakao.maps.CustomOverlay({
      map: map,
      position: position,
      content: meElement(),
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 5
    });
  }

  /**
   * 탭한 좌표에서 가장 가까운 핀을 찾는다.
   * 손가락 터치를 감안해 핀 그림보다 살짝 넉넉한 범위를 허용하고,
   * 물방울형(선택된 핀)은 좌표가 꼬리 끝이라 위쪽으로 판정 범위를 넓힌다.
   */
  function hitTestPlace(latLng) {
    if (!map) return null;
    var projection = map.getProjection();
    var tapped = projection.containerPointFromCoords(latLng);
    var best = null;
    var bestDistance = Infinity;

    for (var i = 0; i < state.places.length; i += 1) {
      var place = state.places[i];
      var point = projection.containerPointFromCoords(new kakao.maps.LatLng(place.latitude, place.longitude));
      var dx = tapped.x - point.x;
      var dy = tapped.y - point.y;
      var selected = place.id === state.selectedPlaceId;
      var withinX = Math.abs(dx) <= 24;
      var withinY = selected ? dy >= -56 && dy <= 10 : Math.abs(dy) <= 24;
      if (!withinX || !withinY) continue;

      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = place.id;
      }
    }

    return best;
  }

  function sendIdle() {
    if (!map) return;
    var center = map.getCenter();
    var bounds = map.getBounds();
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    postToHost({
      type: 'idle',
      view: {
        latitude: center.getLat(),
        longitude: center.getLng(),
        level: map.getLevel(),
        bounds: { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() }
      }
    });
  }

  window.WagleMap = {
    update: function (patch) {
      var placesChanged = false;
      if (patch.places) { state.places = patch.places; placesChanged = true; }
      if (patch.filter && patch.filter !== state.filter) { state.filter = patch.filter; placesChanged = true; }
      if (patch.selectedPlaceId !== undefined && patch.selectedPlaceId !== state.selectedPlaceId) {
        state.selectedPlaceId = patch.selectedPlaceId;
        placesChanged = true;
      }
      if (patch.myLocation !== undefined) { state.myLocation = patch.myLocation; renderMyLocation(); }
      if (placesChanged) renderPlaces();
    },
    /**
     * 좌표를 화면 중앙에 놓는다.
     * liftPx는 바텀시트에 가려지지 않도록 마커를 위로 끌어올릴 픽셀 수다(보이는 영역의 중앙에 맞추기 위함).
     */
    panTo: function (lat, lng, liftPx) {
      if (!map) return;
      centerOn(new kakao.maps.LatLng(lat, lng), liftPx);
    },
    /**
     * 장소명으로 검색해 지도를 그 위치로 옮긴다.
     *
     * 이 호출은 카카오에 등록된 웹 도메인에서만 성공한다(실기기 WebView는 https://localhost).
     * 웹으로 띄울 때는 iframe(srcdoc)의 origin이 opaque라 도메인을 등록해도 401이 난다.
     * 실패하면 placeNotFound를 보내고, 화면이 등록된 좌표로 대신 지도를 맞춘다.
     */
    searchPlace: function (keyword, liftPx) {
      if (!map || !kakao.maps.services) {
        postToHost({ type: 'placeNotFound', keyword: keyword, reason: 'search-failed' });
        return;
      }

      new kakao.maps.services.Places().keywordSearch(keyword, function (results, status) {
        // 검색이 실패하면 이 SDK 버전은 첫 인자로 'ERROR'/'ZERO_RESULT' 문자열을 넘긴다.
        var ok = status === kakao.maps.services.Status.OK && results && results.length && results[0].y;
        if (!ok) {
          postToHost({
            type: 'placeNotFound',
            keyword: keyword,
            reason: status === kakao.maps.services.Status.ZERO_RESULT ? 'no-result' : 'search-failed'
          });
          return;
        }

        var found = results[0];
        var latitude = parseFloat(found.y);
        var longitude = parseFloat(found.x);
        centerOn(new kakao.maps.LatLng(latitude, longitude), liftPx);

        postToHost({
          type: 'placeResolved',
          place: {
            name: found.place_name || keyword,
            address: found.address_name || '',
            roadAddress: found.road_address_name || '',
            phone: found.phone || '',
            latitude: latitude,
            longitude: longitude
          }
        });
      });
    },
    /**
     * 현재 핀이 모두 보이도록 영역을 맞춘다.
     * 핀이 아직 도착하지 않았으면(지도 준비 직후) 첫 렌더 뒤로 미룬다.
     */
    fitPlaces: function (bottomInsetPx) {
      if (!map) return;
      if (state.places.length === 0) {
        pendingFitInset = bottomInsetPx || 0;
        return;
      }
      fitToPlaces(bottomInsetPx);
    },
    setLevel: function (level) {
      if (map) map.setLevel(level, { animate: true });
    },
    relayout: function () {
      if (map) map.relayout();
    }
  };

  // 웹(iframe)에서는 부모 창이 postMessage로 패치를 전달한다.
  window.addEventListener('message', function (event) {
    try {
      var command = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!command || !command.method || !window.WagleMap[command.method]) return;
      window.WagleMap[command.method].apply(null, command.args || []);
    } catch (error) {
      // 지도와 무관한 메시지는 무시한다.
    }
  });

  function initMap() {
    map = new kakao.maps.Map(document.getElementById('map'), {
      center: new kakao.maps.LatLng(INITIAL.lat, INITIAL.lng),
      level: INITIAL.level
    });
    map.setZoomable(true);
    map.setDraggable(true);

    kakao.maps.event.addListener(map, 'idle', sendIdle);
    kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
      var placeId = hitTestPlace(mouseEvent.latLng);
      postToHost(placeId ? { type: 'pinPress', placeId: placeId } : { type: 'mapPress' });
    });

    renderPlaces();
    renderMyLocation();
    postToHost({ type: 'ready' });
    sendIdle();
  }

  function bootstrap() {
    if (!window.kakao || !window.kakao.maps) {
      postToHost({ type: 'error', reason: 'sdk-unavailable' });
      return;
    }
    kakao.maps.load(initMap);
  }

  var sdk = document.createElement('script');
  // 이 요청에만 Referer를 빼서, 도메인 등록 없이도 SDK를 받을 수 있게 한다.
  // 문서 정책은 건드리지 않으므로 services 검색 호출은 Referer를 정상적으로 보낸다.
  sdk.referrerPolicy = 'no-referrer';
  // services: 장소 키워드 검색. 백엔드가 좌표를 주기 전까지 장소명으로 위치를 찾는다.
  sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services';
  sdk.onload = bootstrap;
  sdk.onerror = function () { postToHost({ type: 'error', reason: 'sdk-load-failed' }); };
  document.head.appendChild(sdk);
</script>
</body>
</html>`;
}

export type MapCommand = 'update' | 'panTo' | 'searchPlace' | 'setLevel' | 'fitPlaces' | 'relayout';

/** 지도 안의 `window.WagleMap` 메서드를 호출하는 명령을 직렬화한다. */
export function serializeMapCommand(method: MapCommand, ...args: unknown[]): string {
  return JSON.stringify({ method, args });
}
