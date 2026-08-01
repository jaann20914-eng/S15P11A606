import { Text, View } from 'react-native';
import { CrowdChart } from '@/components/place';
import type { DayCrowdStat, PlaceSummary } from '@/types/place';
import { recommendStyles as s } from '../styles';

export interface RecommendPlaceInfoProps {
  place: PlaceSummary;
  weeklyCrowdStats: DayCrowdStat[];
}

/**
 * 기본정보 — 이름 · 연락처 · 주소 · 요일별 혼잡도.
 *
 * 시안대로 한 장의 카드다. 혼잡도 그래프까지 같은 카드에 두는 이유는 그것도 "이 장소가 어떤
 * 곳인지"에 답하는 정보이기 때문이다. 지금 어떤지는 아래 영상핀이 답한다.
 *
 * 그래프는 장소 상세와 같은 공용 컴포넌트다(`components/place/CrowdChart`).
 */
export function RecommendPlaceInfo({ place, weeklyCrowdStats }: RecommendPlaceInfoProps) {
  return (
    <View style={s.infoCard}>
      <Text style={s.infoName}>{place.name}</Text>
      {/* 연락처는 없는 장소(공원·산책로)가 있어 서버가 null을 준다. 그때는 줄을 그리지 않는다. */}
      {place.phone !== null && <Text style={s.infoText}>연락처 : {place.phone}</Text>}
      <Text style={s.infoText}>{place.address}</Text>

      <View style={s.chartSlot}>
        <CrowdChart stats={weeklyCrowdStats} />
      </View>
    </View>
  );
}
