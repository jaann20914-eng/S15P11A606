import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVideoPlayer } from 'expo-video';
import type { VideoPlayer, VideoSource } from 'expo-video';

/**
 * 이 화면에서 쓰는 3D 장식 영상.
 *
 * 파일이 커서(각 300~600KB) 필요한 순간에 받기 시작하면 몇 프레임 동안 빈 자리가 보이고,
 * 시트가 올라온 뒤에 그림이 따로 채워져 화면이 두 번 바뀐다.
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

interface Illustrations {
  players: Record<IllustrationKey, VideoPlayer>;
  ready: Record<IllustrationKey, boolean>;
  /** 받기를 시작한다. 이미 받았으면 아무 일도 하지 않는다. */
  load: (key: IllustrationKey) => void;
}

const IllustrationContext = createContext<Illustrations | null>(null);

/**
 * 장식 영상을 **필요해질 때** 받아 두는 자리.
 *
 * 화면에 들어오자마자 받지 않는다. 이 화면의 주인공은 현장 영상이라, 장식까지 함께 받으면
 * 정작 봐야 할 것이 늦게 뜬다. 그래서 버튼을 누른 순간에 받기 시작하고, 다 받은 뒤에 시트를
 * 통째로 띄운다 — 기다리는 곳은 누른 버튼 한 자리로 모인다.
 *
 * 플레이어는 화면 하나당 하나씩만 만든다. 시트를 열 때마다 새로 만들면 그때마다 다시 받아
 * 미리 받아 둔 뜻이 없어진다. 대신 다시 열 때 처음부터 재생하려면 쓰는 쪽에서 되감아야 한다.
 */
export function IllustrationProvider({ children }: { children: React.ReactNode }) {
  const coin = useLazyPlayer(SOURCES.coin);
  const chat = useLazyPlayer(SOURCES.chat);
  const leaf = useLazyPlayer(SOURCES.leaf);

  /*
    각 `load`는 그대로 유지되므로 이 함수도 바뀌지 않는다. 쓰는 쪽에서 효과의 의존값으로
    걸어도 매 렌더마다 다시 돌지 않는다.
  */
  const load = useCallback(
    (key: IllustrationKey) => {
      ({ coin: coin.load, chat: chat.load, leaf: leaf.load })[key]();
    },
    [chat.load, coin.load, leaf.load],
  );

  const value = useMemo<Illustrations>(
    () => ({
      players: { coin: coin.player, chat: chat.player, leaf: leaf.player },
      ready: { coin: coin.ready, chat: chat.ready, leaf: leaf.ready },
      load,
    }),
    [chat.player, chat.ready, coin.player, coin.ready, leaf.player, leaf.ready, load],
  );

  return <IllustrationContext.Provider value={value}>{children}</IllustrationContext.Provider>;
}

/**
 * 소스를 나중에 붙이는 플레이어.
 *
 * 빈 플레이어로 만들어 두고 `load()`를 부를 때 소스를 넣는다. 만들어 두는 것 자체는 비용이
 * 거의 없고, 실제로 받아 오는 일은 그때 시작된다.
 */
function useLazyPlayer(source: VideoSource): { player: VideoPlayer; ready: boolean; load: () => void } {
  const [ready, setReady] = useState(false);
  const requested = useRef(false);

  const player = useVideoPlayer(null, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });

    return () => subscription.remove();
  }, [player]);

  const load = useCallback(() => {
    if (requested.current) return;

    requested.current = true;
    player.replace(source);

    // 구독보다 준비가 먼저 끝나는 경우가 있어 한 번 더 본다.
    if (player.status === 'readyToPlay') setReady(true);
  }, [player, source]);

  return { player, ready, load };
}

function useIllustrations(): Illustrations {
  const illustrations = useContext(IllustrationContext);

  if (illustrations === null) {
    throw new Error('장식 영상은 IllustrationProvider 안에서만 쓸 수 있어요');
  }

  return illustrations;
}

export function useIllustration(key: IllustrationKey): { player: VideoPlayer; ready: boolean } {
  const { players, ready } = useIllustrations();

  return { player: players[key], ready: ready[key] };
}

/**
 * 누르면 영상을 받고, 다 받은 뒤에 `run`을 실행하는 버튼용 상태.
 *
 * 받는 동안 `pending`이 참이라 버튼에 로딩을 띄울 수 있다. 열린 뒤에 그림이 따로 채워지는
 * 대신, 누른 버튼에서 잠깐 기다렸다가 시트가 완성된 채로 올라온다.
 *
 * 오래 걸려도 결국은 연다. 장식 때문에 결제·채팅 요청 자체를 막을 수는 없다.
 */
export function useIllustrationCue(
  key: IllustrationKey,
  run: () => void,
  /*
    넉넉히 잡는다. 그림이 준비되기 전에 열리면 시트가 빈 자리를 안고 올라와, 기다린 보람 없이
    화면이 두 번 바뀐다. 이 시간은 "무언가 잘못됐을 때 그래도 열어 주는" 안전장치지 평소에
    닿을 값이 아니다 — 영상 하나가 1MB 남짓이라 정상이면 훨씬 빨리 준비된다.
  */
  timeoutMs = 8000,
): { trigger: () => void; pending: boolean } {
  const { load } = useIllustrations();
  const { ready } = useIllustration(key);
  const [waiting, setWaiting] = useState(false);

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!waiting) return;

    if (ready) {
      setWaiting(false);
      runRef.current();
      return;
    }

    const timer = setTimeout(() => {
      setWaiting(false);
      runRef.current();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [ready, timeoutMs, waiting]);

  const trigger = useCallback(() => {
    load(key);

    if (ready) {
      runRef.current();
      return;
    }

    setWaiting(true);
  }, [key, load, ready]);

  return { trigger, pending: waiting };
}

/** 버튼을 거치지 않고 미리 받아 두고 싶을 때. 평가 보상 나뭇잎이 이 경우다. */
export function useIllustrationLoader(): (key: IllustrationKey) => void {
  return useIllustrations().load;
}
