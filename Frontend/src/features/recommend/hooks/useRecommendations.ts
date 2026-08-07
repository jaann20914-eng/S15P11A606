import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from '@/api/client';
import { getRecommendations } from '@/api/recommend/places';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import type { RecommendationsResponse, RecommendedPlace } from '@/types/recommend';
import { createDevLogger } from '@/utils/devLog';
import { withMinimumDuration } from '@/utils/promise';

const log = createDevLogger('recommend');

export interface RecommendationsState {
  /** 지금 고른 계열. 여유·와글 토글이 이 값을 바꾼다. */
  mode: CrowdFilter;
  /** 고른 계열의 장소 목록. */
  places: RecommendedPlace[];
  /** 추천을 만든 시각(ISO 8601). 아직 못 받았으면 null. */
  generatedAt: string | null;
  /** 위치를 못 써서 인기순으로 대신했는지. 화면에서 그 사실을 알려준다. */
  isFallback: boolean;
  loading: boolean;
  /** 실패 문구. 성공하면 null. */
  error: string | null;
  setMode: (mode: CrowdFilter) => void;
  /** 다시 조회한다. 빈 목록 · 실패 화면의 버튼이 부른다. */
  reload: () => void;
}

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_LOCATION: '위치 정보가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  RECOMMENDATION_FETCH_FAILED: '추천 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  AI_RECOMMENDATION_FAILED: '추천을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 첫 조회에서 로딩 표시를 최소한 이만큼 유지한다. 이유는 `withMinimumDuration` 참고. */
const MIN_LOADING_MS = 500;

/**
 * 추천 장소.
 *
 * **한 번만 조회한다.** 서버가 여유·와글 두 목록을 한 응답으로 주므로 토글을 바꿔도 다시
 * 부르지 않는다. 매번 부르면 같은 데이터를 반복해서 받고, 그 사이 추천이 새로 계산되면
 * 토글을 오갈 때마다 목록이 달라져 보인다.
 *
 * 좌표는 있으면 보내고 없으면 생략한다. 서버가 최근 GPS 캐시로 대신하고, 그것도 없으면
 * 인기순으로 답한다 — 오류가 아니므로 화면은 그대로 목록을 그린다.
 */
export function useRecommendations(): RecommendationsState {
  const [mode, setModeState] = useState<CrowdFilter>('relaxed');
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { request: requestLocation } = useCurrentLocation();

  /** 다시 조회하기. 값이 바뀌면 아래 이펙트가 한 번 더 돈다. */
  const [reloadCount, setReloadCount] = useState(0);

  /** 이미 조회했는지. 화면이 다시 그려져도 두 번 부르지 않는다. */
  const requested = useRef(false);

  /** 무엇이든 한 번 받아 봤는지. 받아 본 뒤의 재조회는 로딩을 보여주지 않는다. */
  const hasDataRef = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    // 이미 목록이 있으면 소리 없이 바꾼다. 탭에 돌아올 때마다 화면이 로딩으로 덮이면 어수선하다.
    setLoading(!hasDataRef.current);
    setError(null);
    log(reloadCount === 0 ? '화면 진입' : '다시 조회');

    /*
      좌표를 못 받아도 요청은 보낸다. 그때는 서버가 캐시나 인기순으로 답한다.

      좌표 단계를 따로 남긴다 — 목록이 비어 있을 때 위치를 못 잡은 것인지, 요청이 실패한
      것인지, 주변에 핀이 없는 것인지 화면만 보고는 구분할 수 없다. 권한 대화상자에서
      사용자가 아무것도 누르지 않으면 이 단계에서 그대로 멈추기도 한다.
    */
    const load = requestLocation().then((coordinate) => {
      log('좌표 단계 끝', { 좌표: coordinate === null ? '없음(생략하고 요청)' : '확보' });

      return getRecommendations(coordinate === null ? {} : coordinate);
    });

    withMinimumDuration(load, MIN_LOADING_MS)
      .then((received) => {
        hasDataRef.current = true;
        setData(received);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        log('실패', { 코드: cause instanceof ApiError ? cause.code : '없음' });

        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '추천 장소를 불러오지 못했어요',
        );
      });
    // 다음 조회를 허용한다. 좌표 · 요청이 모두 끝난 뒤라야 연타로 겹치지 않는다.
  }, [requestLocation, reloadCount]);

  /*
    탭에 돌아올 때 다시 받는다.

    탭 화면은 옮겨도 살아 있어서, 마운트 때 한 번 받고 끝나면 그 뒤에 생긴 핀이 추천에
    반영되지 않았다 — 로그가 처음에만 찍힌 이유다(프론트가 다시 부르지 않은 것이지 캐시가
    아니다). 서버도 짧게 캐시하므로 매번 새로 계산되지는 않는다.

    첫 초점은 건너뛴다. 마운트 효과가 방금 받아 온 직후라 같은 요청을 두 번 보내게 된다.
  */
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }

      requested.current = false;
      setReloadCount((count) => count + 1);
    }, []),
  );

  return {
    mode,
    /*
      계열 키가 없으면 빈 목록으로 둔다.

      서버가 목록 이름을 바꾸면(`relaxed`·`wagle`) 여기서 조용히 비어 버린다. 그 경우를
      화면에서 알아볼 수 있도록 요청 기록에 계열별 개수를 함께 남겨 둔다(`api/recommend/log`).
    */
    /*
      핀이 있는 장소만 보여준다(제품 결정, 2026-08-05). 추천의 근거가 핀인데 핀이 하나도
      없는 장소가 목록에 오르면 눌러도 볼 것이 없다. 서버 후보 선정이 아직 이 기준을 거르지
      않아 프론트가 거른다 — 전부 걸러지면 기존의 빈 목록 안내(첫 핀을 남겨 보라는 화면)가 뜬다.

      기준은 개수(`activePinCount`)가 아니라 **미리보기 핀이 실제로 있는지**다. 개수와 미리보기가
      어긋난 카드가 왔는데(개수는 있는데 미리보기가 빔) 개수로 걸렀더니 핀 없는 카드가 남았다.
      화면이 그리는 것이 미리보기이므로 그것을 기준으로 삼는다.
    */
    places: (data?.recommendations?.[mode] ?? []).filter((place) => place.pinPreviews.length > 0),
    generatedAt: data?.generatedAt ?? null,
    isFallback: data?.recommendationType === 'POPULAR_FALLBACK',
    loading,
    error,
    setMode: useCallback((next: CrowdFilter) => setModeState(next), []),
    reload: useCallback(() => {
      requested.current = false;

      /*
        **눌러서 다시 찾을 때는 로딩을 보여준다.**

        평소의 재조회(탭 복귀)는 이미 목록이 있어 소리 없이 바꾸지만, 이 버튼은 사용자가
        직접 누른 것이라 무언가 일어났다는 표시가 있어야 한다. 게다가 빈 목록에서 누르는
        버튼이라 결과도 대개 그대로여서, 표시가 없으면 눌러도 아무 일이 없는 것으로 읽힌다.
      */
      hasDataRef.current = false;
      setReloadCount((count) => count + 1);
    }, []),
  };
}
