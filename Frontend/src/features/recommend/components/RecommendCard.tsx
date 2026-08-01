import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViewAvatar } from '@/components/common';
import { colors } from '@/constants/theme';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';

export interface RecommendCardProps {
  place: RecommendedPlace;
}

/** 각도 링 지름. 한 줄에 다섯 개가 들어가야 해서 작게 쓴다. */
const ANGLE_RING_SIZE = 30;

/** 추천 장소 한 장. 누르면 장소 상세로 간다. */
export function RecommendCard({ place }: RecommendCardProps) {
  /**
   * 대표 업로더를 뺀 사람 수.
   *
   * 링의 첫 번째가 대표 업로더(감지카메라)이므로 문구는 그 하나를 뺀 수를 센다.
   * 링이 셋이면 "감지카메라 외 2명"이 된다.
   */
  const others = Math.max(place.uploaderCount - 1, 0);

  // 링은 서버가 준 미리보기(최대 5개)를 그대로 쓴다. 넘치는 핀은 `+n`으로 적는다.
  const previews = place.pinPreviews;
  const remaining = Math.max(place.activePinCount - previews.length, 0);

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
            {/* 영업시간을 확인할 수 없으면 서버가 null을 준다. 그때는 줄을 그리지 않는다. */}
            {place.businessHoursText !== null && (
              <Text style={s.hours}>{place.businessHoursText}</Text>
            )}
            <Text style={s.address}>{place.address}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.gray400} />
        </View>

        <View style={s.rule} />

        {/*
          아직 사람이 올린 것이 없으면 각도 링 대신 작성으로 유도한다. "외 0명"이나 빈 줄을
          두면 추천된 이유를 알 수 없고, 이 화면에서 할 수 있는 일도 사라진다.
        */}
        {others === 0 ? (
          // 카드 전체는 장소 상세로 가지만 이 자리는 작성으로 보낸다. 문구가 그렇게 적혀 있다.
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
          <>
            <Text style={s.pinMessage}>
              {place.representativeUploaderNickname} 외 {others}명이 핀을 업로드했습니다
            </Text>

            {/*
              작성자마다 링 모양이 달라야 한다. `ViewAvatar`가 각도별 시안 이미지로 채움 비율을
              그리므로 90°와 320°가 눈에 띄게 다르게 보인다. 단색 테두리로 그리면 각도를 숫자로만
              읽게 되고 링이 아무 정보를 주지 않는다.
            */}
            <View style={s.angleRow}>
              {previews.map((preview) => (
                <ViewAvatar
                  key={preview.pinId}
                  angle={preview.uploaderViewReliability}
                  size={ANGLE_RING_SIZE}
                />
              ))}
              {/* 링으로 보여주지 못한 나머지 핀. 다 보여줬으면 적지 않는다. */}
              {remaining > 0 && <Text style={s.more}>+{remaining}</Text>}
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}
