import { useEffect, useState } from 'react';
import { fetchMockMyPins } from '@/mocks/mypage';
import type { MyPin } from '@/types/mypage';

export interface MyPinsState {
  pins: MyPin[];
  loading: boolean;
}

/** 오늘 작성한 영상핀 목록. 아직 API가 없어 목업을 쓴다. */
export function useMyPins(): MyPinsState {
  const [pins, setPins] = useState<MyPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    fetchMockMyPins()
      .then((found) => {
        if (!alive) return;
        setPins(found);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { pins, loading };
}
