import { Text, View } from 'react-native';
import { ViewAvatar } from '@/components/common';
import type { MyProfileResponse } from '@/types/user';
import { formatViewAngle } from '@/utils/viewAngle';
import { mypageStyles as s } from '../styles';

export interface TrustSummaryCardProps {
  profile: MyProfileResponse;
}

/** 링 지름. 시안의 요약 카드 기준이다. */
const RING_SIZE = 76;

/**
 * 뷰 신뢰도와 오늘 활동 요약.
 *
 * 링은 `ViewAvatar`가 각도별 시안 이미지로 그린다. 채움 비율을 직접 계산하지 않으므로
 * 디자인과 항상 일치한다.
 */
export function TrustSummaryCard({ profile }: TrustSummaryCardProps) {
  return (
    <View style={s.summaryCard}>
      <View style={s.trustRow}>
        <ViewAvatar angle={profile.viewReliability} size={RING_SIZE} />
        <View style={s.trustCopy}>
          <Text style={s.eyebrow}>나의 뷰 신뢰도</Text>
          <Text style={s.trustValue}>{formatViewAngle(profile.viewReliability)}</Text>
          <Text style={s.trustHelp}>유익한 영상과 답변이 쌓일수록 360°에 가까워져요.</Text>
        </View>
      </View>

      <View style={s.metrics}>
        <View style={[s.metric, s.metricFirst]}>
          <Text style={s.metricLabel}>보유 크레딧</Text>
          <Text style={s.metricValue}>{profile.creditBalance}</Text>
        </View>
        <View style={[s.metric, s.metricLast]}>
          <Text style={s.metricLabel}>오늘 영상핀</Text>
          <Text style={s.metricValue}>{profile.todayVideoPinCount}</Text>
        </View>
      </View>
    </View>
  );
}
