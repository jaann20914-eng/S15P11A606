import * as Location from 'expo-location';
import type { Coordinate } from '@/store/useMapStore';

/**
 * 기기 좌표를 읽는 단일 경로.
 *
 * 이 파일이 생긴 이유: 같은 일을 하는 코드가 `useCurrentLocation`과 `usePlaceSearch`에
 * 따로 있었고, 한쪽만 고쳐져 있었다. 검색 쪽은 시간 제한이 없어 실내에서 응답이 오지 않으면
 * 로딩 상태로 멈춰 있었고, 권한을 **확인만** 해서 온보딩을 건너뛴 계정은 영구히 실패했다.
 *
 * 좌표를 쓰는 곳이 늘어날 예정이라(추천·핀 등록) 규칙을 여기 한 곳에만 둔다.
 */

/** 좌표를 얻지 못한 이유. 화면이 문구를 고르는 데 쓴다. */
export type LocationFailure =
  /** 기기의 위치 서비스가 꺼져 있다. 권한과 무관하며 앱에서 켤 수 없다. */
  | 'disabled'
  /** 권한이 없다. 사용자가 거부했거나 아직 묻지 않았다. */
  | 'denied'
  /** 권한은 있는데 좌표를 얻지 못했다. 실내에서 측위가 안 되는 경우가 대부분이다. */
  | 'failed';

export type LocationResult = { coordinate: Coordinate } | { failure: LocationFailure };

/**
 * 좌표를 기다리는 한계 시간(ms).
 *
 * `getCurrentPositionAsync`는 측위에 실패해도 **끝나지 않는다.** 실내·지하에서 흔하고,
 * 그러면 이 프라미스를 기다리는 화면이 로딩 상태에 갇힌다. 반드시 끊어야 한다.
 */
const POSITION_TIMEOUT_MS = 8000;

/** 캐시된 위치를 재사용할 수 있는 최대 나이(ms). 지도 이동·주변 검색에는 충분히 최신이다. */
const LAST_KNOWN_MAX_AGE_MS = 60_000;

/** 개발 중 어디서 끊겼는지 터미널에서 따라갈 수 있게 한다. */
function log(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[location] ${step}`, detail ?? '');
}

/** 주어진 시간 안에 끝나지 않으면 null. 원래 작업은 그대로 두고 기다리기만 그만둔다. */
function withTimeout<T>(work: Promise<T>, limitMs: number): Promise<T | null> {
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), limitMs))]);
}

/**
 * 행정구역 이름에서 흔한 접미사를 떼어 짧게 만든다.
 *
 * 지오코더는 `서울특별시`처럼 정식 명칭을 준다. 한 줄로 보여 주는 자리에서는 길어서
 * 다른 정보를 밀어내므로 통용되는 짧은 이름으로 줄인다.
 */
function shortenRegion(region: string): string {
  return region.replace(/(특별자치시|특별자치도|특별시|광역시)$/, '');
}

/**
 * 좌표를 사람이 읽는 지역 이름으로 바꾼다. 얻지 못하면 null.
 *
 * 플랫폼 지오코더가 채우는 필드는 기기·지역마다 다르다. 그래서 특정 필드를 믿지 않고
 * **가장 좁은 행정구역부터** 있는 것을 고른 뒤 시·도를 앞에 붙인다. 아무것도 없으면 null을
 * 주고, 화면은 그 줄을 비운다 — 틀린 지역명을 보여 주는 것보다 낫다.
 */
export async function readAreaName(coordinate: Coordinate): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coordinate);
    if (!address) return null;

    const area = address.district ?? address.subregion ?? address.city ?? null;
    const region = address.region ? shortenRegion(address.region) : null;

    if (!area) return region;
    // 이미 시·도가 앞에 붙어 있으면 두 번 적지 않는다.
    return region && !area.startsWith(region) ? `${region} ${area}` : area;
  } catch {
    log('지역명 조회 실패');
    return null;
  }
}

export interface ReadCoordinateOptions {
  /**
   * 권한이 없을 때 사용자에게 물을지.
   *
   * `false`면 이미 받아 둔 권한만 쓴다. 화면 진입만으로 대화상자가 뜨는 것을 막아야 할 때다.
   * 사용자가 직접 무언가를 누른 결과라면 `true`가 맞다 — 묻지 않으면 그 기능이 영구히
   * 실패하는데 사용자는 이유를 알 수 없다.
   */
  requestPermission?: boolean;
}

/**
 * 현재 좌표. 실패하면 이유를 함께 돌려준다.
 *
 * 새 측위보다 **캐시된 위치를 먼저** 본다. 즉시 돌아오고, 지도를 옮기거나 주변을 찾는
 * 용도로는 정확도가 충분하다. 새 측위는 실외에서도 몇 초가 걸린다.
 */
/** 지구 반지름(m). 두 좌표 사이 거리를 재는 데 쓴다. */
const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 두 좌표 사이의 직선 거리(m).
 *
 * 하버사인 공식이다. 수백 미터 범위에서는 오차가 사실상 없고, 우리가 재는 거리(50m 안팎)에는
 * 충분하다. 서버도 같은 기준으로 거리를 재므로 판정이 크게 어긋나지 않는다.
 */
export function distanceBetween(from: Coordinate, to: Coordinate): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function readCurrentCoordinate({
  requestPermission = false,
}: ReadCoordinateOptions = {}): Promise<LocationResult> {
  try {
    // 권한이 있어도 기기에서 위치 서비스를 껐으면 좌표를 읽을 수 없다.
    if (!(await Location.hasServicesEnabledAsync())) {
      log('실패', { failure: 'disabled' });
      return { failure: 'disabled' };
    }

    const permission = requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      log('실패', { failure: 'denied', asked: requestPermission });
      return { failure: 'denied' };
    }

    const known = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (known) {
      log('좌표 확보', { source: 'lastKnown' });
      return {
        coordinate: { latitude: known.coords.latitude, longitude: known.coords.longitude },
      };
    }

    // 캐시가 없을 때만 새로 측위한다. 실내에서는 끝나지 않을 수 있어 시간을 끊는다.
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      POSITION_TIMEOUT_MS,
    );

    if (!position) {
      log('실패', { failure: 'failed', reason: 'timeout', limitMs: POSITION_TIMEOUT_MS });
      return { failure: 'failed' };
    }

    log('좌표 확보', { source: 'getCurrentPosition' });
    return {
      coordinate: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch (cause) {
    log('예외', { cause: String(cause) });
    return { failure: 'failed' };
  }
}
