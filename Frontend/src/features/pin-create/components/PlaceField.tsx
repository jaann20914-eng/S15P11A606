import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MIN_PLACE_QUERY_LENGTH } from '@/types/place';
import type { PinDraftPlace } from '@/types/pinCreate';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import { pinCreateStyles as s } from '../styles';

export interface PlaceFieldProps {
  place: PinDraftPlace | null;
  onSelect: (place: PinDraftPlace | null) => void;
}

/**
 * 내 위치 입력.
 *
 * 키워드를 입력하면 반경 50m 안의 장소를 찾아 가까운 순으로 보여주고, 고르면 그 장소만 남긴다.
 * 결과가 많아도 화면이 밀리지 않도록 목록 안에서 스크롤한다.
 */
export function PlaceField({ place, onSelect }: PlaceFieldProps) {
  const search = usePlaceSearch();

  const select = (found: PinDraftPlace) => {
    onSelect(found);
    search.clear();
  };

  // 검색어가 짧으면 요청을 보내지 않으므로 보여줄 것도 없다.
  const tooShort = search.keyword.trim().length < MIN_PLACE_QUERY_LENGTH;
  const hasSomethingToShow =
    search.loading || search.error !== null || search.empty || search.results.length > 0;

  return (
    <>
      <Text style={s.label}>내 위치</Text>

      {place ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="장소 다시 선택"
          onPress={() => onSelect(null)}
          style={s.placeSelected}
        >
          <Text style={s.placeSelectedText}>{place.name}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </Pressable>
      ) : (
        <TextInput
          value={search.keyword}
          onChangeText={search.setKeyword}
          placeholder="현재 계신 장소를 입력하세요"
          placeholderTextColor={colors.gray400}
          style={s.placeInput}
        />
      )}

      {!place && !tooShort && hasSomethingToShow && (
        <View style={s.placeList}>
          {search.loading ? (
            <View style={s.placeStatus}>
              <ActivityIndicator color={colors.gray400} />
            </View>
          ) : search.error ? (
            <View style={s.placeStatus}>
              <Text style={s.placeEmpty}>{search.error}</Text>
              {search.retryable && (
                <Pressable accessibilityRole="button" onPress={search.retry} style={s.placeRetry}>
                  <Text style={s.placeRetryText}>다시 시도</Text>
                </Pressable>
              )}
            </View>
          ) : search.empty ? (
            <Text style={s.placeEmpty}>주변 50m에서 찾지 못했어요. 다른 이름으로 검색해 보세요.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {search.results.map((found) => (
                <Pressable
                  key={found.kakaoPlaceId}
                  accessibilityRole="button"
                  onPress={() => select(found)}
                  style={s.placeRow}
                >
                  <View>
                    <Text style={s.placeName}>{found.name}</Text>
                    <Text style={s.placeAddress}>{found.address}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </>
  );
}
