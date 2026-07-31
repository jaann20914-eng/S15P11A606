import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { color, colors } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';

export interface RecommendCardProps {
  place: RecommendedPlace;
  /** 지금 고른 계열. 각도 링 색을 여유·와글로 나눈다. */
  mode: CrowdFilter;
}

/** 카드에 늘어놓는 각도 링 수. 더 있으면 뒤에 `+n`으로 적는다. */
const VISIBLE_ANGLES = 5;

/** 추천 장소 한 장. 누르면 장소 상세로 간다. */
export function RecommendCard({ place, mode }: RecommendCardProps) {
  const relaxed = mode === 'relaxed';
  const ringColor = relaxed ? color.pin.relaxed.strong : color.pin.wagle.soft;
  const angles = place.authorAngles.slice(0, VISIBLE_ANGLES);

  return (
    <View style={s.cardFrame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${place.name} 상세 보기`}
        onPress={() => router.push(`/place/${place.placeId}`)}
        style={s.card}
      >
        <View style={s.cardTop}>
          <View style={s.placeCopy}>
            <Text style={s.placeName}>{place.name}</Text>
            <Text style={s.hours}>{place.hours}</Text>
            <Text style={s.address}>{place.address}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.gray400} />
        </View>

        <View style={s.rule} />

        <Text style={s.pinMessage}>
          감지카메라 외 {Math.max(place.pinCount - 1, 1)}명이 핀을 업로드했습니다
        </Text>

        <View style={s.angleRow}>
          {angles.map((angle, index) => (
            <View key={`${place.placeId}-${index}`} style={[s.angleRing, { borderColor: ringColor }]}>
              <Text style={s.angleText}>{angle}°</Text>
            </View>
          ))}
          <Text style={s.more}>+{place.pinCount}</Text>
        </View>
      </Pressable>
    </View>
  );
}
