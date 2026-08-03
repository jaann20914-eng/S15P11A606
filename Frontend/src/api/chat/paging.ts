import type { CursorPage, CursorQuery } from '@/types/chat';

/**
 * 커서를 따라가며 **전부** 모은다.
 *
 * 채팅 목록은 무한 스크롤로 두지 않기로 했다. 화면은 한 번에 다 받은 목록만 다루면 되므로
 * 페이지를 이어 붙이는 일을 여기서 끝낸다.
 *
 * 그래도 한 번에 요청하지 않고 커서를 따라간다. 서버가 페이지당 최대 개수를 정하고 있어서,
 * 큰 `limit`을 보내도 잘려 올 수 있다. 그때 첫 장만 쓰면 목록이 조용히 일부만 보인다.
 *
 * 끝나지 않는 경우를 막는 상한을 둔다. 서버가 같은 커서를 계속 돌려주면 무한히 돌게 되는데,
 * 그건 서버 잘못이라도 앱이 멈추는 결과가 된다.
 */
const MAX_PAGES = 20;

export async function fetchAllPages<TItem>(
  loadPage: (query: CursorQuery) => Promise<CursorPage<TItem>>,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await loadPage(cursor === undefined ? {} : { cursor });

    items.push(...result.items);

    if (result.nextCursor === null || result.nextCursor === cursor) return items;

    cursor = result.nextCursor;
  }

  return items;
}
