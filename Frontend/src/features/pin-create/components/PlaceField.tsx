import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { PlaceNearbyItem } from '@/types/place';
import type { PinDraftPlace } from '@/types/pinCreate';
import { useNearbyPlaces } from '../hooks/useNearbyPlaces';
import { pinCreateStyles as s } from '../styles';

export interface PlaceFieldProps {
  place: PinDraftPlace | null;
  onSelect: (place: PinDraftPlace | null) => void;
}

/**
 * 내 위치 선택.
 *
 * **이름을 입력받지 않는다.** 처음 가 본 곳에서 장소 이름을 떠올려 적는 일이 등록에서 가장
 * 걸리는 단계였다. 버튼을 누르면 지금 자리의 장소를 거리순으로 보여주고 그중에서 고른다.
 *
 * 좌표는 누를 때 읽는다. 화면에 들어오자마자 권한을 묻지 않는다.
 *
 * 촬영 자리와 장소의 거리는 여기서 판단하지 않는다. 서버가 재고
 * (LOCATION_OUT_OF_RANGE), 프론트는 고른 것을 지키기만 한다.
 */
export function PlaceField({ place, onSelect }: PlaceFieldProps) {
  const nearby = useNearbyPlaces();

  const select = (found: PlaceNearbyItem) => {
    /*
      응답의 이름을 화면이 쓰는 이름으로 옮긴다.

      주변 조회는 등록 요청과 같은 이름을 쓰지만(`placeName`·`kakaoPlaceLatitude`), 폼은 수정에서
      고르는 내부 장소와 같은 모양이어야 한다 — 거리 검사·표시가 두 경우를 함께 다룬다.
      카카오 메타는 등록 요청에 그대로 실려 가므로 함께 들고 간다.
    */
    onSelect({
      source: 'kakao',
      kakaoPlaceId: found.kakaoPlaceId,
      name: found.placeName,
      address: found.addressName,
      latitude: found.kakaoPlaceLatitude,
      longitude: found.kakaoPlaceLongitude,
      distanceMeters: found.distanceMeters,
      categoryGroupCode: found.categoryGroupCode,
      categoryGroupName: found.categoryGroupName,
      categoryName: found.categoryName,
      phone: found.phone,
    });
    nearby.reset();
  };

  const clear = () => {
    onSelect(null);
    nearby.reset();
  };

  return (
    <>
      <Text style={s.label}>내 위치</Text>

      {place ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="장소 다시 선택"
          onPress={clear}
          style={s.placeSelected}
        >
          <Text style={s.placeSelectedText}>{place.name}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </Pressable>
      ) : (
        /*
          누르기 전에는 입력칸처럼 비어 있다. 여기서 할 일이 "적는 것"이 아니라 "누르는 것"임을
          오른쪽 화살표로 알린다 — 목록을 여는 다른 줄(선택된 장소·수정 화면)과 같은 모양이다.
        */
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="현재 위치의 장소 찾기"
          accessibilityState={{ busy: nearby.loading }}
          disabled={nearby.loading}
          onPress={nearby.find}
          style={s.placeSelected}
        >
          <Text style={s.placePlaceholder}>
            {nearby.loading ? '지금 자리를 확인하고 있어요' : '현재 위치'}
          </Text>
          {nearby.loading ? (
            <ActivityIndicator color={colors.gray400} size="small" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          )}
        </Pressable>
      )}

      {/*
        누른 뒤에만 목록 자리를 만든다. 처음부터 빈 상자를 두면 무엇을 기다리는 자리인지 알 수
        없고, 화면만 길어진다.
      */}
      {!place && nearby.asked && !nearby.loading && (
        <View style={s.placeList}>
          {nearby.error !== null ? (
            <View style={s.placeStatus}>
              <Text style={s.placeEmpty}>{nearby.error}</Text>
              {nearby.retryable && (
                <Pressable accessibilityRole="button" onPress={nearby.find} style={s.placeRetry}>
                  <Text style={s.placeRetryText}>다시 시도</Text>
                </Pressable>
              )}
            </View>
          ) : nearby.empty ? (
            <Text style={s.placeEmpty}>
              주변 50m에서 장소를 찾지 못했어요. 자리를 조금 옮겨 다시 눌러 주세요.
            </Text>
          ) : (
            /*
              목록 안에서 따로 스크롤하지 않는다. 폼이 이미 스크롤 화면이라 그 안에 또 두면
              손가락이 어느 쪽을 움직이는지 애매해져, 아래 후보가 있는지조차 알기 어려웠다.
            */
            <View>
              {nearby.places.map((found) => (
                <Pressable
                  key={found.kakaoPlaceId}
                  accessibilityRole="button"
                  onPress={() => select(found)}
                  style={s.placeRow}
                >
                  <View style={s.placeRowCopy}>
                    <Text style={s.placeName}>{found.placeName}</Text>
                    <Text style={s.placeAddress}>{found.addressName}</Text>
                  </View>
                  {/* 가까운 순으로 오므로 거리를 함께 두면 무엇을 먼저 볼지 판단이 선다. */}
                  <Text style={s.placeDistance}>{found.distanceMeters}m</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );
}
