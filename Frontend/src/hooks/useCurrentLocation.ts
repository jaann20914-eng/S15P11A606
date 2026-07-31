import { useCallback, useRef, useState } from 'react';
import { readCurrentCoordinate } from '@/utils/location';
import type { LocationFailure } from '@/utils/location';
import type { Coordinate } from '@/store/useMapStore';

export type LocationStatus = 'idle' | 'loading' | 'granted' | LocationFailure;

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

const MESSAGE: Record<LocationFailure, string> = {
  denied: '위치 권한을 허용해야 현재 위치로 이동할 수 있어요',
  disabled: '기기의 위치 서비스가 꺼져 있어요',
  failed: '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요',
};

/**
 * 기기의 현재 위치를 가져온다.
 *
 * 권한 요청은 사용자가 "현재 위치" 버튼을 눌렀을 때만 일어난다(화면 진입 시 묻지 않는다).
 * 좌표를 읽는 규칙 자체는 `utils/location`이 갖고 있다.
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
      // 버튼을 눌러 시작한 요청이므로 권한이 없으면 여기서 묻는다.
      const result = await readCurrentCoordinate({ requestPermission: true });

      if ('failure' in result) {
        setStatus(result.failure);
        return null;
      }

      setCoordinate(result.coordinate);
      setStatus('granted');
      return result.coordinate;
    } finally {
      inFlight.current = false;
    }
  }, [coordinate]);

  const message = status in MESSAGE ? MESSAGE[status as LocationFailure] : null;

  return { coordinate, status, message, request };
}
