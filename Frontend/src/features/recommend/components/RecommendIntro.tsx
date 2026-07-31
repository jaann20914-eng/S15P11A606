import { Text, View } from 'react-native';
import { CrowdFilterToggle } from '@/components/common';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { formatRelativeTime } from '@/utils/datetime';
import { recommendStyles as s } from '../styles';

export interface RecommendIntroProps {
  mode: CrowdFilter;
  /** 추천을 다시 계산한 시각(ISO 8601). 아직 못 받았으면 null. */
  updatedAt: string | null;
  /** 좌우 여백. 화면 폭에 따라 달라지므로 화면이 정해서 넘긴다. */
  padding: number;
  onModeChange: (mode: CrowdFilter) => void;
}

/** 추천 목록 위의 안내와 계열 토글. */
export function RecommendIntro({ mode, updatedAt, padding, onModeChange }: RecommendIntroProps) {
  const updated = updatedAt === null ? '' : formatRelativeTime(updatedAt);

  return (
    <View style={[s.intro, { paddingHorizontal: padding }]}>
      <Text style={s.kicker}>취향과 현재 위치를 반영했어요</Text>
      <View style={s.titleRow}>
        <Text style={s.title}>오늘의 장소 추천</Text>
        {/* 갱신 시각을 못 받았거나 미래 시각이면 라벨을 통째로 숨긴다. */}
        {updated !== '' && (
          <View style={s.updateMeta}>
            <View style={s.updateDot} />
            <Text style={s.updateText}>{updated} 업데이트</Text>
          </View>
        )}
      </View>

      <CrowdFilterToggle value={mode} onChange={onModeChange} style={s.filterToggle} />
    </View>
  );
}
