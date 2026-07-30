import { Text, View } from 'react-native';
import type { MyProfileSummary } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface TrustSummaryCardProps {
  summary: MyProfileSummary;
}

/** 신뢰도 한 바퀴. 이 값만큼 링이 다 채워진다. */
const FULL_TRUST_ANGLE = 360;

/**
 * 뷰 신뢰도와 오늘 활동 요약.
 *
 * 링은 하나의 호를 회전시켜 표현한다. 정확한 원호 그래프가 아니라 시안의 근사 표현이며,
 * 각도가 커질수록 호가 오른쪽으로 돈다.
 */
export function TrustSummaryCard({ summary }: TrustSummaryCardProps) {
  const angle = `${summary.trustAngle}°`;
  const rotation = `${(summary.trustAngle / FULL_TRUST_ANGLE) * FULL_TRUST_ANGLE}deg`;

  return (
    <View style={s.summaryCard}>
      <View style={s.trustRow}>
        <View style={s.trustRing}>
          <View style={[s.trustArc, { transform: [{ rotate: rotation }] }]} />
          <View style={s.trustCore}>
            <Text style={s.ringValue}>{angle}</Text>
          </View>
        </View>
        <View style={s.trustCopy}>
          <Text style={s.eyebrow}>나의 뷰 신뢰도</Text>
          <Text style={s.trustValue}>{angle}</Text>
          <Text style={s.trustHelp}>유익한 정보가 쌓이면 신뢰도가 360°에 가까워져요.</Text>
        </View>
      </View>

      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.metricLabel}>보유 크레딧</Text>
          <Text style={s.metricValue}>{summary.creditBalance}</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metric}>
          <Text style={s.metricLabel}>오늘 영상핀</Text>
          <Text style={s.metricValue}>{summary.todayPinCount}</Text>
        </View>
      </View>
    </View>
  );
}
