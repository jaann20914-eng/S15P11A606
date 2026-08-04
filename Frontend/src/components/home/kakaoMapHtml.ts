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

/**
 * 장소 하나를 들여다보는 확대 레벨. 지도 왼쪽 아래 축척 막대가 **250m**를 가리키는 단계다.
 *
 * 카카오 레벨과 축척 막대는 이렇게 대응한다.
 * `1` 20m · `2` 30m · `3` 50m · `4` 100m · `5` 250m · `6` 500m · `7` 1km · `8` 2km …
 *
 * 실기에서 축척 막대가 250m가 아니면 이 숫자 하나만 고치면 된다. 판정하는 쪽은 이 값만 본다.
 */
export const PLACE_FOCUS_MAP_LEVEL = 5;

/**
 * 마커가 **리뷰핀**으로 동작하기 시작하는 확대 레벨. 축척 막대가 **20m**를 가리키는 단계다.
 *
 * 이 값 이하로 당기면 마커를 눌렀을 때 지도만 옮기지 않고 그 장소의 상세까지 연다. 그보다
 * 넓게 보고 있을 때는 지금처럼 지도만 옮긴다 — 넓은 축척에서는 손가락 하나에 여러 장소가
 * 걸려 눌린 것이 내가 노린 곳인지 확신할 수 없고, 그 상태로 화면이 바뀌면 실수가 된다.
 *
 * **지도에 따로 표시하지는 않는다.** 이 축척은 카카오맵이 이미 상호명까지 그려 주는 단계라,
 * 우리가 이름을 한 번 더 적으면 그 글자들과 겹쳐 오히려 읽기 어려워진다.
 *
 * 위 `PLACE_FOCUS_MAP_LEVEL`의 대응표를 따른다. 레벨 5가 축척 250m인 것은 실기기에서
 * 확인했으므로 레벨 1이 20m다. 더 넓은 축척에서도 이렇게 동작하길 원하면 이 숫자만 올린다.
 */
export const REVIEW_PIN_MAX_LEVEL = 1;

const pinTone: Record<CrowdFilter, { fill: string; ring: string }> = {
  relaxed: { fill: color.pin.relaxed.strong, ring: color.pin.relaxed.soft },
  wagle: { fill: color.pin.wagle.strong, ring: color.pin.wagle.soft },
};

export interface KakaoMapHtmlOptions {
  appKey: string;
  center: { latitude: number; longitude: number };
  level?: number;
  /**
   * 장소 키워드 검색(`searchPlace`)을 쓸 화면인지.
   *
   * `libraries=services`는 SDK 본체와 **별도로 내려받는 추가 번들**이라 첫 렌더를 그만큼
   * 늦춘다. 홈 지도는 `panTo`·`fitPlaces`만 쓰고 검색은 하지 않으므로 기본은 끈 상태다.
   */
  usePlaceSearch?: boolean;
}

export function buildKakaoMapHtml({
  appKey,
  center,
  level = DEFAULT_MAP_LEVEL,
  usePlaceSearch = false,
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
  첫 렌더까지의 시간은 대부분 네트워크 대기다. SDK는 dapi.kakao.com에서, 지도 타일은
  daumcdn.net에서 내려오는데 둘 다 이 문서를 파싱하기 전에는 연결이 시작되지 않는다.
  미리 연결해 두면 DNS 조회와 TLS 핸드셰이크가 스크립트 요청과 겹쳐 진행된다.
  crossorigin이 없으면 타일 요청과 다른 커넥션이 잡혀 preconnect가 헛돈다.
-->
<link rel="preconnect" href="https://dapi.kakao.com" crossorigin />
<link rel="preconnect" href="https://t1.daumcdn.net" crossorigin />
<link rel="dns-prefetch" href="https://map.daumcdn.net" />
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
  /*
   * 내 위치 마커. 퍼지는 원과 가운데 점을 **형제로 분리**한다.
   *
   * 예전에는 하나의 flex 컨테이너 안에 가운데 점(자식 div)과 .me::after가 함께 있어서,
   * 둘이 flex 아이템으로 나란히 놓이며 점이 왼쪽으로 밀렸다. 게다가 퍼지는 애니메이션의
   * transform: scale이 점에도 걸려 점 자체가 커졌다 작아지며 중심이 흔들렸다.
   *
   * 중앙 정렬은 transform이 아니라 음수 마진으로 한다. transform은 애니메이션이 독점해야
   * 하므로, 정렬에 같이 쓰면 keyframe마다 translate를 다시 적어야 하고 한 번 빠뜨리면 튄다.
   */
  .me { position: relative; width: 28px; height: 28px; pointer-events: none; }
  .me-pulse {
    position: absolute; left: 50%; top: 50%;
    width: 28px; height: 28px; margin: -14px 0 0 -14px;
    border-radius: 50%;
    animation: mePulse 2s ease-out infinite;
  }
  /* 점은 애니메이션에서 제외해 항상 같은 자리·같은 크기로 남는다. */
  .me-dot {
    position: absolute; left: 50%; top: 50%;
    width: 14px; height: 14px; margin: -7px 0 0 -7px;
    border-radius: 50%;
    box-sizing: border-box;
  }
  @keyframes mePulse { 0% { transform: scale(0.6); opacity: 0.85; } 70% { transform: scale(1.5); opacity: 0.12; } 100% { transform: scale(0.6); opacity: 0.85; } }
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

  /** 카카오 확대 레벨의 양 끝. 이 밖으로 나가면 SDK가 요청을 무시한다. */
  var MIN_LEVEL = 1;
  var MAX_LEVEL = 14;

  var map = null;
  var overlays = [];
  var meOverlay = null;
  /** 겹친 마커를 밀어 놓은 값(id → {dx, dy}). 그릴 때와 탭 판정이 같은 값을 쓴다. */
  var spreadOffsets = {};
  /**
   * RN이 넘겨 준 손가락으로 지도를 끌고 있는지.
   *
   * 끄는 동안에는 프레임마다 중심을 옮기므로 SDK의 idle이 그만큼 쏟아진다. 그때마다 RN이
   * 다시 렌더되면 끄는 손이 무거워지므로, 손을 뗄 때('dragEnd') 한 번만 알린다.
   */
  var manualDrag = false;
  var state = { places: [], filter: 'relaxed', selectedPlaceId: null, myLocation: null };
  /** 핀이 도착하기 전에 들어온 fitPlaces 요청. 첫 렌더 직후 처리한다. */
  var pendingFitInset = null;
  /** 진행 중인 중심 이동 애니메이션의 프레임 id. 없으면 null. */
  var panFrame = null;
  /** requestAnimationFrame이 멈춰도 이동을 끝내기 위한 예비 타이머. */
  var panTimeout = null;
  /** 진행 중인 이동의 도착 좌표. 중간에 끊길 때 이 자리로 마무리한다. */
  var panTarget = null;
  /**
   * 이동이 끝난 뒤 이어서 할 일. 없으면 null.
   *
   * 확대를 이동 뒤로 미루는 데 쓴다. 사용자가 도중에 지도를 끌면 cancelPan이 이 값도 비워,
   * 손으로 옮긴 자리에서 뒤늦게 확대가 튀어나오지 않는다.
   */
  var panDone = null;

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
    el.className = 'me';
    el.innerHTML =
      '<div class="me-pulse" style="background:' + INITIAL.location.pulse + '"></div>' +
      '<div class="me-dot" style="background:' + INITIAL.location.dot + ';border:2px solid ' + INITIAL.location.border + '"></div>';
    return el;
  }

  function clearOverlays() {
    for (var i = 0; i < overlays.length; i += 1) overlays[i].setMap(null);
    overlays = [];
  }

  /**
   * 화면에서 이 거리(px) 안에 있으면 겹친 것으로 본다. 마커 지름(34)보다 조금 작다.
   */
  var OVERLAP_RADIUS_PX = 28;

  /**
   * 겹친 마커를 원으로 벌릴 때의 반지름(px).
   *
   * 이웃한 두 마커 사이가 마커 지름(34)에 숨 쉴 틈(4)을 더한 38px은 되어야 서로 다시 겹치지
   * 않는다. 원 위에 n개를 고르게 놓으면 이웃 간격이 2 x r x sin(pi/n)이므로, 그 값이 38이
   * 되는 반지름을 쓴다. 둘뿐이면 그 식으로 19가 나오지만 그러면 지도에 너무 붙어 보여
   * 최소값을 둔다.
   */
  function spreadRadius(count) {
    return Math.max(22, 19 / Math.sin(Math.PI / count));
  }

  /**
   * 같은 자리에 겹친 마커들을 화면에서 조금씩 밀어 놓을 값을 구한다.
   *
   * **한 자리에서 여러 번 찍으면 핀들의 좌표가 사실상 같다.** 그러면 마커가 완전히 포개져,
   * 여러 개인지 하나인지 알 수 없고 **고른 핀이 바뀌어도 그림이 그대로다** — 물방울은 뾰족한
   * 끝이, 동그라미는 중심이 좌표에 맞으므로 둘의 자리가 서로 바뀌어도 화면은 똑같이 보인다.
   * 카드를 넘겨도 모양이 안 바뀌는 것처럼 보이던 이유가 이것이다.
   *
   * 좌표를 건드리지 않고 **그림만** 민다(요소에 transform). 지도 이동·확대는 원래 좌표 그대로
   * 계산되고, 탭 판정만 같은 값을 더해 맞춘다.
   */
  function computeSpread() {
    var offsets = {};
    if (!map || state.places.length < 2) return offsets;

    var projection = map.getProjection();
    var points = [];
    for (var i = 0; i < state.places.length; i += 1) {
      var place = state.places[i];
      points.push(projection.containerPointFromCoords(
        new kakao.maps.LatLng(place.latitude, place.longitude)
      ));
    }

    /*
      가까운 것끼리 묶는다. 개수가 최대 10개라 단순 비교로 충분하다.
      먼저 만들어진 무리의 첫 마커를 기준으로 삼아, 그 둘레에 드는 것을 같은 무리로 본다.
    */
    var groups = [];
    for (var at = 0; at < points.length; at += 1) {
      var joined = false;
      for (var g = 0; g < groups.length; g += 1) {
        var head = points[groups[g][0]];
        var dx = points[at].x - head.x;
        var dy = points[at].y - head.y;
        if (Math.sqrt(dx * dx + dy * dy) <= OVERLAP_RADIUS_PX) {
          groups[g].push(at);
          joined = true;
          break;
        }
      }
      if (!joined) groups.push([at]);
    }

    for (var k = 0; k < groups.length; k += 1) {
      var group = groups[k];
      if (group.length < 2) continue;

      var radius = spreadRadius(group.length);
      for (var m = 0; m < group.length; m += 1) {
        // 12시에서 시작해 시계 방향으로 돌린다. 순서가 정해져 있어 다시 그려도 자리가 같다.
        var angle = -Math.PI / 2 + (m * 2 * Math.PI) / group.length;
        offsets[state.places[group[m]].id] = {
          dx: Math.round(Math.cos(angle) * radius),
          dy: Math.round(Math.sin(angle) * radius)
        };
      }
    }

    return offsets;
  }

  function renderPlaces() {
    if (!map) return;
    clearOverlays();
    var tone = toneOf(state.filter);
    spreadOffsets = computeSpread();

    for (var i = 0; i < state.places.length; i += 1) {
      var place = state.places[i];
      var selected = place.id === state.selectedPlaceId;
      var element = selected ? dropElement(tone) : circleElement(tone);
      element.setAttribute('aria-label', place.name);

      // 겹친 마커는 화면에서 조금씩 밀어 놓는다. 좌표는 그대로 두고 그림만 옮긴다.
      var offset = spreadOffsets[place.id];
      if (offset) {
        element.style.transform = 'translate(' + offset.dx + 'px,' + offset.dy + 'px)';
      }

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

  /**
   * 좌표를 liftPx만큼 아래로 밀어 놓은 좌표. 바텀시트에 가리지 않게 하는 보정이다.
   *
   * 이 좌표를 지도 중심으로 삼으면 원래 좌표가 "보이는 영역의 중앙"에 온다.
   * panBy는 이 SDK 버전에서 동작하지 않아 좌표 자체를 옮긴다.
   *
   * 화면 픽셀과 좌표의 변환은 확대 레벨이 같으면 일정하므로, 지도를 옮기지 않고 미리 계산해도
   * 결과가 같다. 예전에는 setCenter로 한 번 옮긴 뒤 다시 계산해 **이동이 두 번** 일어났고,
   * 그래서 어디로 가든 화면이 두 번 튀었다.
   */
  function liftedLatLng(latLng, liftPx) {
    if (!liftPx) return latLng;

    var projection = map.getProjection();
    var point = projection.containerPointFromCoords(latLng);
    return projection.coordsFromContainerPoint(new kakao.maps.Point(point.x, point.y + liftPx));
  }

  /** 이동에 쓰는 시간(ms). 거리가 멀수록 조금 길게 준다. */
  var PAN_BASE_MS = 360;
  var PAN_MAX_MS = 820;
  /** 화면 이 배수를 넘게 멀면 손으로 미는 동작으로 볼 수 없어 즉시 옮긴다. */
  var PAN_MAX_SCREENS = 20;

  /** 진행 중인 이동을 버린다. 지금 있는 자리에 그대로 멈춘다. */
  function cancelPan() {
    if (panFrame !== null) {
      cancelAnimationFrame(panFrame);
      panFrame = null;
    }
    if (panTimeout !== null) {
      clearTimeout(panTimeout);
      panTimeout = null;
    }
    panTarget = null;
    panDone = null;
  }

  /**
   * 진행 중인 이동을 도착 지점으로 즉시 마무리한다.
   *
   * requestAnimationFrame은 화면이 가려지면 **호출이 멈춘다.** 게시글로 넘어가는 순간
   * 이동이 중간에서 얼어붙고, 돌아왔을 때 중심이 어중간한 자리에 남는다. 게다가 그동안
   * panFrame이 비워지지 않아 idle 알림까지 계속 막힌다.
   *
   * 그래서 화면이 가려질 때와 예비 타이머에서 이 함수로 확실히 끝낸다.
   */
  function finishPan() {
    if (panTarget === null) return;

    var target = panTarget;
    // cancelPan이 비우기 전에 붙잡아 둔다. 끝맺음을 건너뛰면 확대가 영영 오지 않는다.
    var done = panDone;
    cancelPan();
    map.setCenter(target);
    sendIdle();
    if (done) done();
  }

  /** 시작과 끝이 느리고 가운데가 빠른 곡선. 손으로 밀어 놓는 느낌에 가깝다. */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * 중심을 옮긴다. animate면 매 프레임 조금씩 옮겨 이어지는 움직임을 만든다.
   *
   * **SDK의 panTo를 쓰지 않는다.** panTo는 이동 거리가 화면보다 크면 애니메이션을 스스로
   * 건너뛴다. 우리 장소들은 서로 몇 km씩 떨어져 있어 거의 항상 그 조건에 걸리고, 그러면
   * 화면이 순간적으로 바뀌어 새 화면이 열린 것처럼 보인다. 그래서 직접 보간한다.
   */
  function centerOn(latLng, liftPx, animate, onDone) {
    var target = liftedLatLng(latLng, liftPx);
    cancelPan();

    if (!animate) {
      map.setCenter(target);
      if (onDone) onDone();
      return;
    }

    var from = map.getCenter();
    var fromLat = from.getLat();
    var fromLng = from.getLng();
    var toLat = target.getLat();
    var toLng = target.getLng();

    // 화면 몇 개 분량을 가로지르는지로 거리를 잰다. 확대 레벨이 달라도 체감이 일정해진다.
    var projection = map.getProjection();
    var fromPoint = projection.containerPointFromCoords(from);
    var toPoint = projection.containerPointFromCoords(target);
    var dx = toPoint.x - fromPoint.x;
    var dy = toPoint.y - fromPoint.y;
    var screens = Math.sqrt(dx * dx + dy * dy) / Math.max(1, window.innerWidth);

    // 이미 그 자리면 옮기지 않는다. 같은 카드를 두 번 눌러도 흔들리지 않는다.
    // 다만 뒤이어 할 일(확대)은 그대로 이어 간다 — 자리가 맞다고 축척까지 맞은 것은 아니다.
    if (screens < 0.002) {
      if (onDone) onDone();
      return;
    }

    if (screens > PAN_MAX_SCREENS) {
      map.setCenter(target);
      sendIdle();
      if (onDone) onDone();
      return;
    }

    var duration = Math.min(PAN_MAX_MS, PAN_BASE_MS + screens * 80);
    var startedAt = null;

    function step(now) {
      if (startedAt === null) startedAt = now;
      var progress = Math.min(1, (now - startedAt) / duration);
      var eased = easeInOutCubic(progress);

      map.setCenter(new kakao.maps.LatLng(
        fromLat + (toLat - fromLat) * eased,
        fromLng + (toLng - fromLng) * eased
      ));

      if (progress < 1) {
        panFrame = requestAnimationFrame(step);
        return;
      }

      var done = panDone;
      cancelPan();
      // 움직이는 동안은 idle을 막아 두었으므로(initMap 참고) 끝난 자리를 한 번 알린다.
      sendIdle();
      if (done) done();
    }

    panTarget = target;
    panDone = onDone || null;
    // rAF가 멈춰도 이 타이머가 이동을 마무리한다. 여유를 조금 둬 정상 완료를 방해하지 않는다.
    panTimeout = setTimeout(finishPan, duration + 400);
    panFrame = requestAnimationFrame(step);
  }

  function fitToPlaces(bottomInsetPx) {
    var inset = bottomInsetPx || 0;

    // 한 곳뿐이면 영역 맞추기가 최대 확대로 튀므로 중심 이동으로 처리한다.
    if (state.places.length === 1) {
      var only = state.places[0];
      // 확대 레벨을 먼저 맞춘다. 중심 보정은 픽셀 기준이라 나중에 줌이 바뀌면 어긋난다.
      map.setLevel(${level});
      // 첫 화면을 잡는 단계라 애니메이션 없이 곧바로 놓는다.
      centerOn(new kakao.maps.LatLng(only.latitude, only.longitude), Math.round(inset / 2), false);
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
      // 겹쳐서 밀어 놓은 마커는 그림이 있는 자리로 판정해야 손가락과 맞는다.
      var offset = spreadOffsets[place.id] || { dx: 0, dy: 0 };
      var dx = tapped.x - (point.x + offset.dx);
      var dy = tapped.y - (point.y + offset.dy);
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
    panTo: function (lat, lng, liftPx, animate) {
      if (!map) return;
      centerOn(new kakao.maps.LatLng(lat, lng), liftPx, animate !== false);
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
        // 화면에 처음 자리를 잡는 용도라 즉시 이동한다.
        centerOn(new kakao.maps.LatLng(latitude, longitude), liftPx, false);

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
      // 영역 맞춤은 목표를 새로 정하는 것이므로 진행 중인 이동을 끊는다.
      cancelPan();
      if (state.places.length === 0) {
        pendingFitInset = bottomInsetPx || 0;
        return;
      }
      fitToPlaces(bottomInsetPx);
    },
    /**
     * 화면 픽셀만큼 지도를 끈다. 손가락이 간 방향으로 지도가 따라온다.
     *
     * **장소 상세 화면이 쓴다.** 그 화면은 이 지도를 반투명하게 비추고 있을 뿐이라 손가락이
     * WebView까지 닿지 않는다 — 안드로이드에서 위에 겹친 화면(react-native-screens의 'Screen')이
     * 터치를 그대로 삼키기 때문이다. 그래서 상세가 제스처를 받아 이 명령으로 넘긴다.
     *
     * 중심을 옮길 뿐이라 확대 레벨과 무관하게 손가락과 지도가 같은 거리를 간다.
     */
    dragBy: function (dx, dy) {
      if (!map) return;
      // 진행 중인 이동은 버린다. 손보다 지도가 앞서 가면 안 된다('dragstart'와 같은 이유다).
      cancelPan();
      manualDrag = true;

      var projection = map.getProjection();
      var point = projection.containerPointFromCoords(map.getCenter());
      // 지도가 손가락을 따라가려면 중심은 반대로 움직여야 한다.
      map.setCenter(projection.coordsFromContainerPoint(new kakao.maps.Point(point.x - dx, point.y - dy)));
    },
    /** 끄는 손을 뗐을 때. 멈춘 자리를 한 번만 알린다. */
    dragEnd: function () {
      if (!map) return;
      manualDrag = false;
      sendIdle();
    },
    /**
     * 지금 중심을 그대로 두고 한 단계 당기거나 넓힌다. 'step'이 양수면 당긴다.
     *
     * 두 손가락으로 벌리는 동작을 대신한다. 'setLevel'과 달리 목표 레벨을 모르는 쪽에서 부를 수
     * 있어야 한다 — 부르는 쪽(상세 화면)은 지금 축척을 알지 못한다.
     */
    zoomBy: function (step) {
      if (!map) return;
      cancelPan();

      var next = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, map.getLevel() - step));
      if (next === map.getLevel()) return;

      map.setLevel(next, { animate: true });
      // 축척은 곧바로 바뀌므로 여기서 알린다. 애니메이션이 끝나며 한 번 더 오는 것은 무해하다.
      sendIdle();
    },
    setLevel: function (level) {
      if (!map) return;
      // 확대와 이동이 겹치면 서로 목표를 덮어써 화면이 튄다. 이동을 먼저 끊는다.
      cancelPan();
      map.setLevel(level, { animate: true });
    },
    /**
     * 한 장소를 화면 중앙으로 데려오고, 필요하면 그만큼 당겨 본다.
     *
     * **미는 것이 먼저다.** 이유가 둘이다.
     * - 당긴 뒤에 밀면 같은 거리가 화면 몇 배로 늘어난다. centerOn은 화면 20개를 넘게
     *   가로지르면 애니메이션을 포기하고 순간이동하므로, 쓸어가는 느낌이 사라진다.
     * - 확대는 시작 시점의 중심을 그대로 유지한다. 그래서 밀어서 자리를 잡아 둔 뒤에 당겨야
     *   그 자리가 결과로 남는다. 반대로 하면 확대가 끝나며 옮기기 전 자리로 되돌아간다.
     *
     * **확대는 애니메이션으로 한다.** 여러 단계를 한 번에 뛰면 타일 묶음이 통째로 바뀌어
     * 화면이 비었다가 다시 채워진다. 애니메이션은 있던 타일을 늘려 가며 새 타일을 받으므로
     * 두 손가락으로 벌리는 것처럼 이어진다.
     *
     * 그런데 애니메이션은 언제 끝나는지 알 수 없어 끝난 뒤에 중심을 보정할 수가 없다. 그래서
     * **보정을 확대 전에 미리 반영한다** — 아래 shrink 참고. 확대는 중심을 그대로 두므로,
     * 미리 맞춰 둔 자리가 그대로 결과가 된다.
     *
     * targetLevel보다 이미 더 당겨져 있으면 축척은 건드리지 않는다. 사용자가 자기 손으로
     * 더 가까이 본 것을 되돌리지 않는다.
     */
    focusPlace: function (lat, lng, targetLevel, liftPx) {
      if (!map) return;

      var target = new kakao.maps.LatLng(lat, lng);
      var currentLevel = map.getLevel();
      var needsZoom = typeof targetLevel === 'number' && currentLevel > targetLevel;

      if (!needsZoom) {
        centerOn(target, liftPx, true);
        return;
      }

      /*
        한 단계 당길 때마다 픽셀당 거리가 절반이 된다. 그래서 확대가 끝난 뒤 liftPx만큼
        떨어져 보이게 하려면, 지금은 그 거리를 2^(단계 차)로 나눈 만큼만 올려 두면 된다.

        확대 폭이 아주 크면 지금 기준으로는 1픽셀도 안 되는 값이 되어 보정이 무뎌진다.
        목록에서 고르는 실제 폭(두세 단계)에서는 수십 픽셀이라 문제되지 않는다.
      */
      var shrink = Math.pow(2, currentLevel - targetLevel);

      centerOn(target, (liftPx || 0) / shrink, true, function () {
        // 확대는 중심을 유지한다. 방금 맞춘 자리가 그대로 남는다.
        map.setLevel(targetLevel, { animate: true });
        /*
          바뀐 축척을 곧바로 알린다. 애니메이션이 끝나며 지도가 idle을 한 번 더 보내지만,
          그것만 믿으면 알림이 오지 않았을 때 화면 쪽이 여전히 "덜 당겨진 상태"로 알고 있어
          같은 카드를 눌러도 상세로 넘어가지 못한다.
        */
        sendIdle();
      });
    },
    relayout: function () {
      if (map) map.relayout();
    }
  };

  /*
    화면이 가려지면 requestAnimationFrame이 멈춘다. 게시글로 넘어가는 순간이 그렇다.
    이동을 도착 지점으로 끝내 두어야 돌아왔을 때 중심이 어긋나 있지 않다.
  */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) finishPan();
  });

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

    /*
      이동 애니메이션 중에는 프레임마다 idle이 떠서 같은 알림이 RN으로 쏟아진다.
      화면이 멈춘 뒤 한 번만 보내면 되므로, 움직이는 동안은 건너뛰고 centerOn이 끝낼 때 보낸다.
    */
    kakao.maps.event.addListener(map, 'idle', function () {
      if (panFrame === null && !manualDrag) sendIdle();
    });

    // 사용자가 직접 밀기 시작하면 진행 중인 이동을 멈춘다. 손보다 지도가 앞서 가면 안 된다.
    kakao.maps.event.addListener(map, 'dragstart', cancelPan);

    /*
      확대가 바뀌면 겹침을 다시 계산한다.

      밀어 놓는 값은 **화면 픽셀** 기준이라 축척이 달라지면 판정도 달라진다 — 멀리서는 겹치던
      핀들이 당기면 저절로 떨어지고, 그때까지 밀어 둔 채로 두면 오히려 어긋나 보인다.
      마커는 최대 10개라 다시 그려도 부담이 없다.
    */
    kakao.maps.event.addListener(map, 'zoom_changed', renderPlaces);

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
  // services: 장소 키워드 검색. 쓰는 화면에서만 붙인다 — 안 쓰는 화면에서는 첫 렌더만 늦춘다.
  sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false${usePlaceSearch ? '&libraries=services' : ''}';
  sdk.onload = bootstrap;
  sdk.onerror = function () { postToHost({ type: 'error', reason: 'sdk-load-failed' }); };
  document.head.appendChild(sdk);
</script>
</body>
</html>`;
}

export type MapCommand =
  | 'update'
  | 'panTo'
  | 'focusPlace'
  | 'searchPlace'
  | 'setLevel'
  | 'fitPlaces'
  | 'relayout'
  | 'dragBy'
  | 'dragEnd'
  | 'zoomBy';

/** 지도 안의 `window.WagleMap` 메서드를 호출하는 명령을 직렬화한다. */
export function serializeMapCommand(method: MapCommand, ...args: unknown[]): string {
  return JSON.stringify({ method, args });
}
