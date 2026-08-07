import { Text, View } from 'react-native';
import { CrowdFilterToggle } from '@/components/common';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { recommendStyles as s } from '../styles';

export interface RecommendIntroProps {
  mode: CrowdFilter;
  /** 위치를 못 써서 인기순으로 대신했는지. 부제가 달라진다. */
  isFallback: boolean;
  /** 좌우 여백. 화면 폭에 따라 달라지므로 화면이 정해서 넘긴다. */
  padding: number;
  onModeChange: (mode: CrowdFilter) => void;
}

/**
 * 계열별 부제.
 *
 * 무엇을 고른 목록인지 한 줄로 말한다. 토글이 바뀌면 이 줄도 함께 바뀌어, 지금 어느 쪽을
 * 보고 있는지가 토글 말고도 읽힌다.
 */
const subtitleByMode: Record<CrowdFilter, string> = {
  relaxed: '지금 여유로운 곳으로 떠나볼까요?',
  wagle: '지금 북적이는 곳으로 가볼까요?',
};

/** 추천 목록 위의 안내와 계열 토글. */
export function RecommendIntro({ mode, isFallback, padding, onModeChange }: RecommendIntroProps) {
  return (
    <View style={[s.intro, { paddingHorizontal: padding }]}>
      <View style={s.titleRow}>
        <Text style={s.title}>오늘의 장소 추천</Text>
        <CrowdFilterToggle value={mode} onChange={onModeChange} />
      </View>

      {/*
        위치를 쓰지 못했거나 개인화에 실패하면 서버가 인기순으로 대신 준다. 오류가 아니라
        기준이 다른 것이므로, 목록은 그대로 보여주되 무엇을 기준으로 골랐는지는 밝힌다.
      */}
      <Text style={s.subtitle}>{isFallback ? '지금 많이 찾는 장소를 모았어요' : subtitleByMode[mode]}</Text>
    </View>
  );
}
