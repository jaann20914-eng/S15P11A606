import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '@/store/useMapStore';

export type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'failed' | 'disabled';

export interface CurrentLocation {
  /** 마지막으로 확인된 내 위치. 아직 못 받았으면 null. */
  coordinate: Coordinate | null;
  status: LocationStatus;
  /**
   * 실패했을 때 사용자에게 보여줄 문구. 실패가 아니면 null.
   *
   * 이게 없으면 위치를 못 받았을 때 화면에 아무 변화가 없어 버튼이 고장난 것처럼 보인다.
   */
  message: string | null;
  /** 권한을 확인하고 현재 좌표를 가져온다. 성공하면 좌표를, 실패하면 null을 돌려준다. */
  request: () => Promise<Coordinate | null>;
}

/**
 * 좌표를 기다리는 한계 시간(ms).
 *
 * `getCurrentPositionAsync`는 위성을 잡지 못하면 **끝나지 않는다.** 실내나 지하에서 흔한
 * 일이고, 그러면 버튼을 눌러도 영영 아무 일도 일어나지 않는다. 시간을 끊어 두어야
 * 사용자에게 실패를 알리고 다시 누를 수 있게 된다.
 */
const POSITION_TIMEOUT_MS = 8000;

const MESSAGE: Record<'denied' | 'failed' | 'disabled', string> = {
  denied: '위치 권한을 허용해야 현재 위치로 이동할 수 있어요',
  disabled: '기기의 위치 서비스가 꺼져 있어요',
  failed: '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요',
};

/** 개발 중 위치 요청이 어디서 끊겼는지 터미널에서 따라갈 수 있게 한다. */
function logLocation(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[location] ${step}`, detail ?? '');
}

/** 주어진 시간 안에 끝나지 않으면 null. 원래 작업은 그대로 두고 기다리기만 그만둔다. */
function withTimeout<T>(work: Promise<T>, limitMs: number): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), limitMs)),
  ]);
}

/**
 * 기기의 현재 위치를 가져온다.
 *
 * 권한 요청은 사용자가 "현재 위치" 버튼을 눌렀을 때만 일어난다(화면 진입 시 묻지 않는다).
 * Expo Go에는 위치 권한이 이미 선언되어 있어 별도 빌드 없이 동작한다.
 */
export function useCurrentLocation(): CurrentLocation {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  /** 버튼 연타로 요청이 겹치는 것을 막는다. */
  const inFlight = useRef(false);

  const request = useCallback(async () => {
    if (inFlight.current) return coordinate;
    inFlight.current = true;
    setStatus('loading');

    const fail = (next: 'denied' | 'failed' | 'disabled') => {
      logLocation('실패', { status: next });
      setStatus(next);
      return null;
    };

    const succeed = (next: Coordinate, source: string) => {
      logLocation('좌표 확보', { source });
      setCoordinate(next);
      setStatus('granted');
      return next;
    };

    try {
      logLocation('요청 시작');

      // 권한이 있어도 기기에서 위치 서비스를 껐으면 좌표를 읽을 수 없다.
      if (!(await Location.hasServicesEnabledAsync())) return fail('disabled');

      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return fail('denied');

      /*
        마지막으로 알려진 위치를 먼저 본다. 캐시된 값이라 즉시 돌아오고, 지도를 옮기는
        용도로는 충분히 정확하다. 새 측위는 실외에서도 몇 초가 걸려 버튼이 굳은 것처럼 보인다.
      */
      const known = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
      if (known) {
        return succeed(
          { latitude: known.coords.latitude, longitude: known.coords.longitude },
          'lastKnown',
        );
      }

      // 캐시가 없을 때만 새로 측위한다. 실내에서는 끝나지 않을 수 있어 시간을 끊는다.
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        POSITION_TIMEOUT_MS,
      );
      if (!position) return fail('failed');

      return succeed(
        { latitude: position.coords.latitude, longitude: position.coords.longitude },
        'getCurrentPosition',
      );
    } catch (cause) {
      logLocation('예외', { cause: String(cause) });
      return fail('failed');
    } finally {
      inFlight.current = false;
    }
  }, [coordinate]);

  const message =
    status === 'denied' || status === 'failed' || status === 'disabled' ? MESSAGE[status] : null;

  return { coordinate, status, message, request };
}
