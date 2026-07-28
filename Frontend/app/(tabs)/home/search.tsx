import { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as TextStyle)
  : undefined;

type RecentSearch = {
  id: number;
  label: string;
  date: string;
  kind: 'keyword' | 'place';
};

const initialRecent: RecentSearch[] = [
  { id: 1, label: '카페', date: '07.22.', kind: 'keyword' },
  { id: 2, label: '암사편한세상아파트', date: '07.20.', kind: 'place' },
  { id: 3, label: '암사편한세상', date: '07.20.', kind: 'keyword' },
  { id: 4, label: '역삼문화 휴가든', date: '07.19.', kind: 'place' },
  { id: 5, label: '역삼', date: '07.19.', kind: 'keyword' },
  { id: 6, label: '역삼역', date: '07.19.', kind: 'keyword' },
];

const placeResults = [
  {
    id: '1',
    name: '역삼문화 휴가든',
    address: '서울 강남구 테헤란로7길 21',
    meta: '777m · 자연공원 · 리뷰 7',
  },
  {
    id: '2',
    name: '역삼역 2호선',
    address: '서울 강남구 테헤란로 156',
    meta: '283m · 지하철,전철',
  },
];

function LeadingIcon({ kind }: { kind: RecentSearch['kind'] }) {
  return (
    <View style={s.iconCircle}>
      <Ionicons
        name={kind === 'place' ? 'location' : 'search'}
        size={16}
        color={colors.gray400}
      />
    </View>
  );
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const start = name.indexOf(query);
  if (start < 0) return <Text style={s.placeName}>{name}</Text>;
  return (
    <Text style={s.placeName}>
      {name.slice(0, start)}
      <Text style={s.highlight}>{name.slice(start, start + query.length)}</Text>
      {name.slice(start + query.length)}
    </Text>
  );
}

export default function Search() {
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(initialRecent);
  const normalizedQuery = query.trim();
  const suggestions = useMemo(
    () => normalizedQuery ? [`${normalizedQuery}역`, `${normalizedQuery}역 맛집`, `${normalizedQuery} 맛집`] : [],
    [normalizedQuery],
  );

  const submit = (value: string) => {
    setQuery(value);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.searchWrap}>
        <View style={s.searchField}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.iconButton}>
            <Ionicons name="chevron-back" size={24} color={colors.dark} />
          </Pressable>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit(query)}
            placeholder="장소명이나 태그를 입력하세요"
            placeholderTextColor={colors.gray600}
            returnKeyType="search"
            selectionColor={colors.blue}
            style={[s.input, webNoOutline]}
          />
          {query.length > 0 && (
            <Pressable accessibilityLabel="검색어 지우기" onPress={() => setQuery('')} style={s.clearButton}>
              <Ionicons name="close" size={15} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {normalizedQuery ? (
          <>
            <View style={s.suggestionGroup}>
              {suggestions.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => submit(suggestion)} style={s.suggestionRow}>
                  <LeadingIcon kind="keyword" />
                  <Text numberOfLines={1} style={s.suggestionText}>
                    <Text style={s.highlight}>{normalizedQuery}</Text>
                    {suggestion.slice(normalizedQuery.length)}
                  </Text>
                  <Ionicons name="arrow-up-outline" size={19} color={colors.dark} style={s.returnArrow} />
                </Pressable>
              ))}
            </View>

            <View style={s.groupDivider} />

            <View style={s.placeGroup}>
              {placeResults.map((place) => (
                <Pressable key={place.id} onPress={() => router.push(`/place/${place.id}`)} style={s.placeRow}>
                  <LeadingIcon kind="place" />
                  <View style={s.placeCopy}>
                    <HighlightedName name={place.name} query={normalizedQuery} />
                    <Text style={s.placeAddress}>{place.address}</Text>
                    <Text style={s.placeMeta}>{place.meta}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : recent.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>최근 검색</Text>
            <View style={s.titleRule} />
            {recent.map((item) => (
              <Pressable key={item.id} onPress={() => setQuery(item.label)} style={s.recentRow}>
                <LeadingIcon kind={item.kind} />
                <Text numberOfLines={1} style={s.recentLabel}>{item.label}</Text>
                <Text style={s.date}>{item.date}</Text>
                <Pressable
                  accessibilityLabel={`${item.label} 검색 기록 삭제`}
                  hitSlop={10}
                  onPress={(event) => {
                    event.stopPropagation();
                    setRecent((current) => current.filter((recentItem) => recentItem.id !== item.id));
                  }}
                  style={s.deleteButton}
                >
                  <Ionicons name="close" size={19} color={colors.gray600} />
                </Pressable>
              </Pressable>
            ))}
          </>
        ) : (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyMark}>!</Text>
            </View>
            <Text style={s.emptyText}>최근 검색한 기록이 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  searchWrap: { paddingHorizontal: layout.gutter, paddingTop: spacing.x3, paddingBottom: spacing.x2 },
  searchField: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F1F3F5',
    paddingLeft: spacing.x1,
    paddingRight: spacing.x3,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { ...type.label, flex: 1, height: 52, paddingHorizontal: spacing.x1, borderWidth: 0, color: colors.dark },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#7D7F82',
  },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: spacing.x10 },
  sectionTitle: { ...type.small, color: colors.gray600, marginTop: spacing.x2, marginBottom: spacing.x2 },
  titleRule: { height: 1, backgroundColor: colors.gray200 },
  recentRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F5',
  },
  recentLabel: { ...type.label, flex: 1, color: colors.dark },
  date: { ...type.caption, color: colors.gray400 },
  deleteButton: { width: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 64 },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5D8DC',
  },
  emptyMark: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: colors.white },
  emptyText: { ...type.label, color: colors.dark, marginTop: spacing.x5 },
  suggestionGroup: { marginTop: spacing.x1 },
  suggestionRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  suggestionText: { ...type.label, flex: 1, color: colors.dark },
  highlight: { color: '#2F80ED', fontWeight: '600' },
  returnArrow: { transform: [{ rotate: '-45deg' }] },
  groupDivider: { height: 8, marginHorizontal: -layout.gutter, backgroundColor: colors.gray100 },
  placeGroup: { marginTop: 0 },
  placeRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    paddingVertical: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  placeCopy: { flex: 1, minWidth: 0 },
  placeName: { ...type.label, color: colors.dark },
  placeAddress: { ...type.caption, color: colors.gray600, marginTop: 2 },
  placeMeta: { ...type.caption, color: colors.gray600 },
});
