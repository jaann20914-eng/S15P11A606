import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
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
 * 키워드를 입력하면 주변 장소를 찾아 목록으로 보여주고, 고르면 그 장소만 남긴다.
 * 결과가 많아도 화면이 밀리지 않도록 목록 안에서 스크롤한다.
 */
export function PlaceField({ place, onSelect }: PlaceFieldProps) {
  const search = usePlaceSearch();

  const select = (found: PinDraftPlace) => {
    onSelect(found);
    search.clear();
  };

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

      {!place && (search.results.length > 0 || search.empty) && (
        <View style={s.placeList}>
          {search.empty ? (
            <Text style={s.placeEmpty}>주변에서 찾지 못했어요. 다른 이름으로 검색해 보세요.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {search.results.map((found) => (
                <Pressable
                  key={found.placeId}
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
