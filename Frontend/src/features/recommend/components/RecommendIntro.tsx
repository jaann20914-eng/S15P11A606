import { Text, View } from 'react-native';
import { CrowdFilterToggle } from '@/components/common';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { formatRelativeTime } from '@/utils/datetime';
import { recommendStyles as s } from '../styles';

export interface RecommendIntroProps {
  mode: CrowdFilter;
  /** 추천을 만든 시각(ISO 8601). 아직 못 받았으면 null. */
  generatedAt: string | null;
  /** 위치를 못 써서 인기순으로 대신했는지. 안내 문구가 달라진다. */
  isFallback: boolean;
  /** 좌우 여백. 화면 폭에 따라 달라지므로 화면이 정해서 넘긴다. */
  padding: number;
  onModeChange: (mode: CrowdFilter) => void;
}

/** 추천 목록 위의 안내와 계열 토글. */
export function RecommendIntro({
  mode,
  generatedAt,
  isFallback,
  padding,
  onModeChange,
}: RecommendIntroProps) {
  const updated = generatedAt === null ? '' : formatRelativeTime(generatedAt);

  return (
    <View style={[s.intro, { paddingHorizontal: padding }]}>
      {/*
        위치를 쓰지 못했거나 개인화에 실패하면 서버가 인기순으로 대신 준다. 오류가 아니라
        기준이 다른 것이므로, 목록은 그대로 보여주되 무엇을 기준으로 골랐는지는 밝힌다.
      */}
      <Text style={s.kicker}>
        {isFallback ? '지금 많이 찾는 장소예요' : '취향과 현재 위치를 반영했어요'}
      </Text>

      <View style={s.titleRow}>
        <Text style={s.title}>오늘의 장소 추천</Text>
        {/* 시각을 못 받았거나 미래 시각이면 라벨을 통째로 숨긴다. */}
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
