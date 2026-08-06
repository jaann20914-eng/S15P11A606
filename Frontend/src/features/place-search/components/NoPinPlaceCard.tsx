import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { recommendStyles as s } from '@/features/recommend/styles';

/**
 * 핀이 아직 없는 장소 한 장.
 *
 * **추천 화면의 장소 카드와 같은 모양이다**(`features/recommend/components/RecommendCard`의
 * 핀 없는 경우). 두 화면이 같은 말을 하고 있어서다 — "이 장소는 찾았지만 아직 올라온 것이
 * 없다, 그러니 당신이 먼저 남겨 달라". 사용자가 같은 카드로 알아보는 편이 낫다.
 *
 * 그래서 **스타일은 추천 것을 그대로 가져다 쓴다**(`recommendStyles`). 값을 베껴 오면 한쪽만
 * 고쳐져 둘이 서로 달라진다. 추천 쪽 파일은 건드리지 않으므로 그 화면 동작은 그대로다.
 *
 * 다른 것은 눌렀을 때다. 추천 카드는 장소 상세로 가지만 **이 장소에는 갈 상세가 없다** —
 * 우리 DB에 없는 카카오 장소라 `placeId`가 없다(`ConfirmedPlaceSummary`). 이 화면에서 할 수
 * 있는 일은 첫 핀을 남기는 것뿐이라, 카드를 눌러도 안쪽 문구를 눌러도 작성으로 간다.
 */

export interface NoPinPlaceCardProps {
  name: string;
  /** 카카오에서 받은 주소. 재조회가 실패하면 빈 문자열로 오므로 그때는 줄을 그리지 않는다. */
  address: string;
  /**
   * 이 장소에 핀을 쓸 수 있는지 — 내 위치에서 50m 안일 때만 참(판정은 화면이 한다).
   *
   * 핀 등록은 지금 서 있는 자리의 장소만 고를 수 있어서, 멀리서 검색해 들어온 장소에는
   * 작성으로 보내는 버튼을 내밀지 않는다 — 눌러 봐야 등록 화면의 장소 목록에 그 장소가 없다.
   * 그때는 핀이 없다는 안내만 남기고 카드도 눌리지 않는다.
   */
  writable: boolean;
}

export function NoPinPlaceCard({ name, address, writable }: NoPinPlaceCardProps) {
  const goToWrite = () => router.push('/(tabs)/write');

  return (
    <View style={s.cardFrame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={writable ? `${name}에 핀 작성하기` : name}
        accessibilityState={{ disabled: !writable }}
        disabled={!writable}
        onPress={goToWrite}
        style={s.card}
      >
        <View style={s.cardTop}>
          <View style={s.placeCopy}>
            <Text style={s.placeName}>{name}</Text>
            {address.length > 0 && <Text style={s.address}>{address}</Text>}
          </View>
          {/* 꺽새는 "누르면 넘어간다"는 표시라 갈 수 없을 때는 함께 뺀다. */}
          {writable && <Ionicons name="chevron-forward" size={22} color={colors.gray400} />}
        </View>

        <View style={s.rule} />

        {/*
          카드 전체와 같은 곳으로 가지만 자리를 따로 둔다. 추천 카드와 같은 구성이어야 하고,
          "여기서 무엇을 할 수 있는지"가 글자로 적혀 있어야 한다.
        */}
        <View style={s.emptyPins}>
          {writable ? (
            <>
              <Text style={s.emptyPinsText}>아직 업로드된 핀이 없습니다</Text>
              <Text style={s.writeLink}>작성하러 가기 →</Text>
            </>
          ) : (
            // 멀리 있는 장소. 작성으로 부르지 않고 상태만 완곡하게 알린다.
            <Text style={s.emptyPinsText}>아직 작성된 핀이 없어요</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}
