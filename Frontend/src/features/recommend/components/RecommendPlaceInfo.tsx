import { Text, View } from 'react-native';
import type { PlaceSummary } from '@/types/place';
import { PlaceholderBlock } from './PlaceholderBlock';
import { recommendStyles as s } from '../styles';

export interface RecommendPlaceInfoProps {
  place: PlaceSummary;
}

/**
 * 기본정보 — 이름 · 연락처 · 주소.
 *
 * 아래에 요일별 혼잡도 그래프 자리가 이어진다. 그 그래프는 장소 상세(홈 쪽)에서도 같은
 * 데이터로 같은 모양을 그리므로, 그쪽 담당자가 만든 공용 컴포넌트를 가져다 쓰기로 했다.
 */
export function RecommendPlaceInfo({ place }: RecommendPlaceInfoProps) {
  return (
    <View style={s.infoCard}>
      <Text style={s.infoName}>{place.name}</Text>
      {/* 연락처는 없는 장소(공원·산책로)가 있어 서버가 null을 준다. 그때는 줄을 그리지 않는다. */}
      {place.phone !== null && <Text style={s.infoText}>연락처 : {place.phone}</Text>}
      <Text style={s.infoText}>{place.address}</Text>

      {/*
        === 요일별 혼잡도 그래프 자리 ===

        홈/장소 상세 담당자가 만드는 그래프 컴포넌트를 여기에 그대로 끼우면 된다.

        - 데이터: `GET /api/v1/places/{placeId}` 응답의 `weeklyCrowdStats`
          (`DayCrowdStat[]` — `types/place.ts`). 이 화면은 `useRecommendPlaceDetail`이
          이미 받아 두고 있으므로 화면에서 props로 내려 주기만 하면 된다.
        - 값이 없는 요일은 `averageCrowdLevel`이 null로 온다. 0으로 그리지 않아야 한다.
        - 이 자리에 컴포넌트를 넣을 때 `PlaceholderBlock`을 지우고, 화면
          (`app/(tabs)/recommend/[placeId].tsx`)에서 `weeklyCrowdStats`를 내려 주면 된다.

        이전에 이 화면에서 쓰던 자체 구현은 커밋 8b51582의 `CrowdWeekChart.tsx`에 있다.
        공용 컴포넌트가 없거나 급할 때 되살려 쓸 수 있다.
      */}
      <PlaceholderBlock
        label="요일별 혼잡도"
        note="장소 상세 담당자의 공용 그래프 컴포넌트를 가져와 끼울 자리"
        height={150}
      />
    </View>
  );
}
