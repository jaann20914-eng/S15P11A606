import { useCallback, useEffect, useRef, useState } from 'react';
import { readAreaName, readCurrentCoordinate } from '@/utils/location';
import type { LocationFailure } from '@/utils/location';
import type { Coordinate } from '@/store/useMapStore';

export type LocationStatus = 'idle' | 'loading' | 'granted' | LocationFailure;

export interface CurrentLocation {
  /** 마지막으로 확인된 내 위치. 아직 못 받았으면 null. */
  coordinate: Coordinate | null;
  /**
   * 그 좌표의 지역 이름(`서울 성수1동`). 아직 못 얻었거나 조회에 실패하면 null.
   *
   * 좌표보다 늦게 도착하고 실패할 수도 있어 좌표와 따로 둔다. 화면은 값이 있을 때만 줄을 그린다.
   */
  areaName: string | null;
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

export interface CurrentLocationOptions {
  /**
   * 화면에 들어올 때 좌표를 미리 읽을지.
   *
   * **권한은 묻지 않는다.** 화면을 열자마자 대화상자가 뜨는 것은 사용자가 시작하지 않은
   * 일이라 맥락이 없다. 회원가입에서 이미 받아 둔 권한이 있으면 조용히 읽고, 없으면
   * 아무 일도 하지 않는다 — 실패해도 문구를 띄우지 않는다.
   */
  auto?: boolean;
}

/**
 * 기기의 현재 위치를 가져온다.
 *
 * 버튼을 눌러 요청하면 권한이 없을 때 묻는다. `auto`로 미리 읽을 때는 묻지 않는다.
 * 좌표를 읽는 규칙 자체는 `utils/location`이 갖고 있다.
 */
export function useCurrentLocation({ auto = false }: CurrentLocationOptions = {}): CurrentLocation {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);
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

  /*
    미리 읽기. 실패는 조용히 넘긴다 — 사용자가 요청한 일이 아니라서 알릴 이유가 없고,
    버튼을 누르면 그때 권한을 묻고 이유도 보여준다.

    버튼 요청이 진행 중이면 건너뛴다. 그쪽이 더 최신이고 권한까지 묻는 경로다.
  */
  useEffect(() => {
    if (!auto) return;

    let applies = true;

    void readCurrentCoordinate().then((result) => {
      if (!applies || 'failure' in result || inFlight.current) return;
      setCoordinate(result.coordinate);
      setStatus('granted');
    });

    return () => {
      applies = false;
    };
  }, [auto]);

  /*
    지역명은 좌표가 정해진 뒤에 따로 조회한다. 좌표를 쓰는 쪽(지도 이동)을 지오코딩 응답까지
    기다리게 하지 않으려는 것이다. 실패하면 null로 두고 화면이 그 줄을 비운다.
  */
  useEffect(() => {
    if (!coordinate) return;

    let applies = true;
    void readAreaName(coordinate).then((name) => {
      if (applies) setAreaName(name);
    });

    return () => {
      applies = false;
    };
  }, [coordinate]);

  const message = status in MESSAGE ? MESSAGE[status as LocationFailure] : null;

  return { coordinate, areaName, status, message, request };
}
