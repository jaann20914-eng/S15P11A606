import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useVideoPlayer } from 'expo-video';
import type { VideoPlayer, VideoSource } from 'expo-video';

/**
 * 이 화면에서 쓰는 3D 장식 영상.
 *
 * 파일이 커서(각 300~600KB) 필요할 때 마운트하면 몇 프레임 동안 빈 자리가 보인다. 시트가
 * 올라오는 도중에 흰 사각형이 있다가 뒤늦게 그림이 채워져 화면이 두 번 바뀐다.
 */
const SOURCES = {
  /** 결제 시트의 코인. */
  coin: require('../../../assets/videos/credit-coin-3d.mp4') as VideoSource,
  /** 채팅 요청 시트의 반딧불. */
  chat: require('../../../assets/videos/chat-request-3d.mp4') as VideoSource,
  /** 평가 보상 자리의 나뭇잎. */
  leaf: require('../../../assets/videos/credit-leaf-3d.mp4') as VideoSource,
};

export type IllustrationKey = keyof typeof SOURCES;

export interface Illustrations {
  /** 미리 만들어 둔 플레이어. 화면이 살아 있는 동안 같은 것을 계속 쓴다. */
  players: Record<IllustrationKey, VideoPlayer>;
  /** 셋 다 재생할 준비가 되었는지. */
  ready: boolean;
}

const IllustrationContext = createContext<Illustrations | null>(null);

/**
 * 화면에 들어오는 순간 장식 영상을 모두 불러 둔다.
 *
 * 데이터를 받아 오는 동안 함께 받으므로 대개 로딩이 끝날 때 영상도 준비돼 있다. 쓰는 쪽은
 * 이미 준비된 플레이어를 받아 곧바로 재생하니 빈 자리가 보이지 않는다.
 *
 * 플레이어는 화면 하나당 하나씩만 만든다. 시트를 열 때마다 새로 만들면 그때마다 다시 불러와
 * 미리 받아 둔 뜻이 없어진다. 대신 다시 볼 때 처음부터 재생하려면 쓰는 쪽에서 `currentTime`을
 * 0으로 되돌려야 한다.
 */
export function IllustrationProvider({ children }: { children: React.ReactNode }) {
  const coin = usePreloadedPlayer(SOURCES.coin);
  const chat = usePreloadedPlayer(SOURCES.chat);
  const leaf = usePreloadedPlayer(SOURCES.leaf);

  const value = useMemo<Illustrations>(
    () => ({
      players: { coin: coin.player, chat: chat.player, leaf: leaf.player },
      ready: coin.ready && chat.ready && leaf.ready,
    }),
    [chat.player, chat.ready, coin.player, coin.ready, leaf.player, leaf.ready],
  );

  return <IllustrationContext.Provider value={value}>{children}</IllustrationContext.Provider>;
}

/** 준비될 때까지 재생하지 않고 기다리기만 하는 플레이어. */
function usePreloadedPlayer(source: VideoSource): { player: VideoPlayer; ready: boolean } {
  const [ready, setReady] = useState(false);

  const player = useVideoPlayer(source, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  useEffect(() => {
    // 구독보다 준비가 먼저 끝났을 수 있어 지금 상태도 함께 본다.
    if (player.status === 'readyToPlay') setReady(true);

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });

    return () => subscription.remove();
  }, [player]);

  return { player, ready };
}

/**
 * 미리 받아 둔 플레이어를 꺼내 쓴다.
 *
 * 공급자 밖에서 부르면 화면이 조립을 빠뜨린 것이므로 조용히 넘어가지 않고 끊는다.
 */
export function useIllustration(key: IllustrationKey): VideoPlayer {
  const illustrations = useContext(IllustrationContext);

  if (illustrations === null) {
    throw new Error('useIllustration은 IllustrationProvider 안에서만 쓸 수 있어요');
  }

  return illustrations.players[key];
}

/** 셋 다 준비됐는지. 화면이 로딩을 언제 거둘지 정하는 데 쓴다. */
export function useIllustrationsReady(): boolean {
  return useContext(IllustrationContext)?.ready ?? true;
}

/**
 * 준비될 때까지 기다리되, 오래 걸리면 그냥 넘어간다.
 *
 * 장식 영상 때문에 화면 전체가 붙잡히면 안 된다. 느린 망에서는 몇 초씩 걸릴 수 있고, 그때는
 * 장식이 조금 늦게 채워지는 편이 아무것도 못 보는 것보다 낫다.
 */
export function useIllustrationsSettled(timeoutMs = 2000): boolean {
  const ready = useIllustrationsReady();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return ready || expired;
}
