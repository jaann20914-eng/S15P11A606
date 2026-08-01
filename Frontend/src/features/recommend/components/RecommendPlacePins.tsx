import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViewAvatar } from '@/components/common';
import { usesMockApi } from '@/api/config';
import { colors } from '@/constants/theme';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  place: RecommendedPlace;
}

/** 목록 행의 각도 링 지름. 카드(30)보다 크게 잡아 상세에서 각도가 눈에 들어오게 한다. */
const ANGLE_RING_SIZE = 40;

/** 목업에서 눌러볼 수 있는 핀 시나리오 수(`mocks/pin.ts`의 1~6번). */
const MOCK_PIN_SCENARIO_COUNT = 6;

/**
 * 영상핀 목록.
 *
 * 추천 응답이 주는 것은 핀 식별자와 작성자 뷰 각도뿐이다(`pinPreviews`). 메모·썸네일·시각은
 * 장소별 핀 조회가 생겨야 채울 수 있어, 지금은 가진 값만으로 줄을 세운다. 각 줄은 핀 상세로
 * 보내므로 목록이 얇아도 할 일은 그대로 된다.
 *
 * 목업에서는 실제 핀 식별자 대신 시나리오 번호로 보낸다. 추천 목업의 `pinId`(101, 102…)는
 * 핀 목업 표에 없어 그대로 열면 조회 실패 화면이 뜬다.
 */
export function RecommendPlacePins({ place }: RecommendPlacePinsProps) {
  const previews = place.pinPreviews;
  const remaining = Math.max(place.activePinCount - previews.length, 0);

  return (
    <View style={s.pinSection}>
      <View style={s.pinSectionHead}>
        <Text style={s.pinSectionTitle}>실시간 영상핀</Text>
        <Text style={s.pinSectionMeta}>{place.activePinCount}개</Text>
      </View>

      {previews.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${place.name}에 영상핀 작성하기`}
          onPress={() => router.push('/(tabs)/write')}
          style={s.emptyPins}
        >
          <Text style={s.emptyPinsText}>아직 업로드된 핀이 없습니다</Text>
          <Text style={s.writeLink}>작성하러 가기 →</Text>
        </Pressable>
      ) : (
        <View style={s.pinList}>
          {previews.map((preview, index) => (
            <Pressable
              key={preview.pinId}
              accessibilityRole="button"
              accessibilityLabel={`영상핀 열기, 뷰 ${preview.uploaderViewReliability}도`}
              onPress={() =>
                router.push(
                  usesMockApi
                    ? `/pin/${(index % MOCK_PIN_SCENARIO_COUNT) + 1}`
                    : `/pin/${preview.pinId}`,
                )
              }
              style={s.pinRow}
            >
              <ViewAvatar angle={preview.uploaderViewReliability} size={ANGLE_RING_SIZE} />
              <View style={s.pinRowCopy}>
                {/*
                  서버가 이름을 주는 것은 대표 업로더 한 명뿐이다. 나머지는 익명 정책대로 표시명을
                  받지 못하므로 지어내지 않고 각도만 보여준다.
                */}
                <Text style={s.pinRowName}>
                  {index === 0 ? place.representativeUploaderNickname : '익명 작성자'}
                </Text>
                <Text style={s.pinRowMeta}>뷰 {preview.uploaderViewReliability}°</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            </Pressable>
          ))}

          {/* 미리보기는 최대 5개다. 나머지가 몇 개인지는 알려 준다. */}
          {remaining > 0 && <Text style={s.pinMore}>외 {remaining}개의 영상핀이 더 있어요</Text>}
        </View>
      )}
    </View>
  );
}
