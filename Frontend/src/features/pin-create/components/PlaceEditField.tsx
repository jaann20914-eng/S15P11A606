import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MAX_PLACE_DISTANCE_METERS } from '@/types/pinCreate';
import type { InternalDraftPlace, PinDraftPlace } from '@/types/pinCreate';
import { usePlaceCandidates } from '../hooks/usePlaceCandidates';
import { pinCreateStyles as s } from '../styles';

export interface PlaceEditFieldProps {
  place: PinDraftPlace | null;
  onSelect: (place: PinDraftPlace) => void;
  /** 후보를 찾을 기준. 원래 등록된 장소의 좌표다. */
  origin: InternalDraftPlace | null;
}

/**
 * 수정 화면의 장소 입력.
 *
 * 등록과 다르게 **검색하지 않는다.** 수정 API는 우리 DB의 내부 식별자만 받는데 카카오 검색은
 * 그 값을 주지 않기 때문이다. 대신 원래 장소 주변 50m 안의 우리 장소를 목록으로 보여준다.
 *
 * 그 범위인 이유는 서버 규칙이다 — 최종 장소와 촬영 좌표가 50m 이내여야 한다. 촬영 좌표는
 * 그대로 두므로, 원래 장소에서 50m 안이면 안전하게 고를 수 있다.
 */
export function PlaceEditField({ place, onSelect, origin }: PlaceEditFieldProps) {
  const [choosing, setChoosing] = useState(false);
  const candidates = usePlaceCandidates(choosing ? origin : null);

  const others = candidates.places.filter(
    (candidate) => place?.source !== 'internal' || candidate.placeId !== place.placeId,
  );

  return (
    <>
      <Text style={s.label}>내 위치</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={choosing ? '장소 변경 취소' : '장소 변경'}
        onPress={() => setChoosing((current) => !current)}
        style={s.placeSelected}
      >
        <Text style={s.placeSelectedText}>{place?.name ?? '장소 없음'}</Text>
        <Ionicons name={choosing ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.gray400} />
      </Pressable>

      {choosing && (
        <View style={s.placeList}>
          {candidates.loading ? (
            <View style={s.placeStatus}>
              <ActivityIndicator color={colors.lime} />
            </View>
          ) : candidates.error ? (
            <Text style={s.placeEmpty}>{candidates.error}</Text>
          ) : others.length === 0 ? (
            <Text style={s.placeEmpty}>
              주변 {MAX_PLACE_DISTANCE_METERS}m에 옮길 만한 다른 장소가 없어요.
            </Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {others.map((candidate) => (
                <Pressable
                  key={candidate.placeId}
                  accessibilityRole="button"
                  onPress={() => {
                    // 거리는 목록에서만 쓰는 값이라 폼에는 넣지 않는다.
                    const { distanceMeters: _distance, ...selected } = candidate;
                    onSelect(selected);
                    setChoosing(false);
                  }}
                  style={s.placeRow}
                >
                  <View>
                    <Text style={s.placeName}>{candidate.name}</Text>
                  </View>
                  <Text style={s.placeDistance}>{candidate.distanceMeters}m</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </>
  );
}
