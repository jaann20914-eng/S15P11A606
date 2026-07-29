import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from '@/store/useMapStore';

export type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'failed';

export interface CurrentLocation {
  /** 마지막으로 확인된 내 위치. 아직 못 받았으면 null. */
  coordinate: Coordinate | null;
  status: LocationStatus;
  /** 권한을 확인하고 현재 좌표를 가져온다. 성공하면 좌표를, 실패하면 null을 돌려준다. */
  request: () => Promise<Coordinate | null>;
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

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.warn('[location] 기기의 위치 서비스가 꺼져 있습니다.');
        setStatus('failed');
        return null;
      }

      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        console.warn('[location] 사용자가 전경 위치 권한을 허용하지 않았습니다.');
        setStatus('denied');
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      console.info('[location] 현재 기기 좌표', next);
      setCoordinate(next);
      setStatus('granted');
      return next;
    } catch (cause) {
      console.error('[location] 현재 좌표 취득 실패', cause);
      setStatus('failed');
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [coordinate]);

  return { coordinate, status, request };
}
