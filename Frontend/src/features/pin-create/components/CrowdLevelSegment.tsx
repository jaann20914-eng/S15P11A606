import { Pressable, Text, View } from 'react-native';
import { crowdLevels } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import { pinCreateStyles as s } from '../styles';

/** 혼잡한 단계를 왼쪽에 두는 순서 (와글와글 → 유유자적). */
const segments = [...crowdLevels].reverse();

export interface CrowdLevelSegmentProps {
  value: CrowdLevelValue;
  onChange: (level: CrowdLevelValue) => void;
}

/** 혼잡도 선택. 선택된 칸만 그 단계의 색으로 채운다. */
export function CrowdLevelSegment({ value, onChange }: CrowdLevelSegmentProps) {
  return (
    <View style={s.segment}>
      {segments.map((item) => {
        const selected = value === item.level;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.level)}
            style={[s.segmentItem, selected && { backgroundColor: item.color }]}
          >
            <Text style={[s.segmentText, selected && s.segmentTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
