import { useEffect, useMemo, useState } from 'react';
import { getPinThumbnails, type PinThumbnail } from '@/api/pin/thumbnail';
import type { PlacePinCard } from '@/types/place';
import type { PinId } from '@/types/pin';

/** 핀이 아직 오지 않았을 때 쓰는 빈 목록. 매번 새로 만들면 아래 `useMemo`가 헛돈다. */
const NO_PINS: PlacePinCard[] = [];

/**
 * 핀 카드에 썸네일을 채운다.
 *
 * **장소 상세 응답의 썸네일은 그릴 수 없는 값이다** — 서버가 S3 객체 키를 담아 주고
 * `api/place/detail.ts`가 경계에서 null로 걸러 낸다. 그래서 카드마다 색 자리만 남는다.
 * 볼 수 있는 주소는 핀 상세가 요청 시점에 발급하므로 여기서 카드별로 받아 온다
 * (`api/pin/thumbnail.ts`에 그 사정과 재사용 규칙을 적어 두었다).
 *
 * **가릴지 말지도 같은 응답에서 받아 고친다.** 카드 응답의 `isUnlocked`는 결제 기록이라
 * 작성자 본인이 false로 오는데, 그대로 두면 자기 게시물의 썸네일이 자기에게도 흐리게 보인다.
 * 핀 상세의 접근 수준은 `OWNER`까지 구분하므로 그것으로 `revealed`를 정한다.
 *
 * 받지 못한 핀은 주소가 없는 채로 남는다. 카드는 이미 그 경우를 색 자리로 그리고 있어서
 * 화면이 깨지지 않는다 — **한 장이 실패해도 나머지는 채워진다.**
 *
 * 첫 응답에 이미 주소가 들어 있으면(목업이 채워 주거나, 서버가 카드 조립기에서도 Presigned
 * URL을 주기 시작하면) 아무것도 묻지 않고 그 값을 그대로 쓴다.
 */
export function usePinThumbnails(pins: PlacePinCard[] | undefined): PlacePinCard[] {
  const [resolved, setResolved] = useState<Record<PinId, PinThumbnail>>({});
  const cards = pins ?? NO_PINS;

  /*
    아직 주소가 없는 핀들. 목록을 **문자열 하나**로 접어 효과의 조건으로 쓴다.

    배열을 조건에 그대로 두면 화면이 다시 그려질 때마다 새 배열이라 효과가 매번 돌고, 그때마다
    카드 수만큼의 조회가 다시 나간다. 문자열은 내용이 같으면 같은 값이라 그런 일이 없다.
  */
  const pendingIds = cards
    .filter((pin) => pin.thumbnailUrl === null && resolved[pin.pinId] === undefined)
    .map((pin) => pin.pinId)
    .join(',');

  useEffect(() => {
    if (pendingIds === '') return;

    /* 화면을 떠난 뒤에 도착한 응답으로 상태를 건드리지 않는다. */
    let alive = true;

    getPinThumbnails(pendingIds.split(','))
      .then((thumbnails) => {
        if (!alive || thumbnails.size === 0) return;
        setResolved((current) => ({ ...current, ...Object.fromEntries(thumbnails) }));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [pendingIds]);

  return useMemo(
    () =>
      cards.map((pin) => {
        if (pin.thumbnailUrl !== null) return pin;

        const thumbnail = resolved[pin.pinId];
        if (thumbnail === undefined) return pin;

        return { ...pin, thumbnailUrl: thumbnail.url, revealed: thumbnail.revealed };
      }),
    [cards, resolved],
  );
}
