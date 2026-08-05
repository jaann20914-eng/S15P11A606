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
        /*
          홈의 장소 상세(`/place/[placeId]`)로 보내지 않는다. 그쪽은 홈 지도 위에 겹치는
          바텀시트라 추천 목록 위에서 열면 배경이 어긋나고, 돌아오는 길도 시트를 내리는
          동작뿐이다. 추천 안에는 같은 내용을 제 화면으로 보여주는 상세가 따로 있다.
        */
        /*
          좌표도 함께 넘긴다. 상세는 지도를 그 좌표로 곧바로 만들고, 영상핀 좌표를 받아 올
          때(`GET /api/v1/places`)도 그 자리 주변만 물어본다. 넘기지 못하면 상세가 기본 중심
          주변을 넓게 훑어야 하고, 그 범위 밖이면 지도를 못 그린다.

          아직 추천 명세에 좌표가 없어 값이 없을 수 있다. 그때는 파라미터를 빼고 보낸다.
        */
        onPress={() =>
          router.push({
            pathname: '/(tabs)/recommend/[placeId]',
            params: {
              placeId: place.placeId,
              ...(place.latitude !== undefined && place.longitude !== undefined
                ? { latitude: place.latitude, longitude: place.longitude }
                : null),
            },
          })
        }
        style={s.card}
      >
        <View style={s.cardTop}>
          <View style={s.placeCopy}>
            <Text style={s.placeName}>{place.name}</Text>
            {/* 영업시간을 확인할 수 없으면 서버가 null을 준다. 그때는 줄을 그리지 않는다. */}
            {place.businessHoursText !== null && place.businessHoursText !== undefined && (
              <Text style={s.hours}>{place.businessHoursText}</Text>
            )}
            <Text style={s.address}>{place.address}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.gray400} />
        </View>

        <View style={s.rule} />

        {/*
          핀이 정말 없을 때만 작성으로 유도한다. 기준은 미리보기가 비었는지다 — 예전에는
          "업로더가 1명"(others === 0)일 때도 이 안내가 떠서, 핀이 있는 장소가 "아직 업로드된
          핀이 없습니다"라고 말했다. 목록 훅이 미리보기 없는 장소를 걸러 주므로 이 분기는
          사실상 안전망이다.
        */}
        {previews.length === 0 ? (
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
            {/* 혼자 올린 장소에 "외 0명"이라고 적지 않는다. */}
            <Text style={s.pinMessage}>
              {others === 0
                ? `${place.representativeUploaderNickname}님이 핀을 업로드했습니다`
                : `${place.representativeUploaderNickname} 외 ${others}명이 핀을 업로드했습니다`}
            </Text>

            {/*
              작성자마다 링 모양이 달라야 한다. `ViewAvatar`가 각도별 시안 이미지로 채움 비율을
              그리므로 90°와 320°가 눈에 띄게 다르게 보인다. 단색 테두리로 그리면 각도를 숫자로만
              읽게 되고 링이 아무 정보를 주지 않는다.
            */}
            <View style={s.angleRow}>
              {previews.map((preview) => (
                <ViewAvatar key={preview.pinId} angle={preview.uploaderViewAngle} size={ANGLE_RING_SIZE} />
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
