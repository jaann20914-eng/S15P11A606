import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CrowdFilterToggle } from '@/components/common';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';
import { color, colors, layout, radius, spacing, type } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';

const recommendations = [
  {
    id: '1',
    name: '성수 연무장길',
    hours: '영업중 · 오후 10:00까지',
    address: '서울 성동구 연무장길',
    pins: 8,
  },
  {
    id: '2',
    name: '서울숲 산책로',
    hours: '운영중 · 24시간 이용 가능',
    address: '서울 성동구 뚝섬로 273',
    pins: 12,
  },
  {
    id: '3',
    name: '뚝섬한강공원',
    hours: '운영중 · 24시간 이용 가능',
    address: '서울 광진구 강변북로 139',
    pins: 6,
  },
  {
    id: '4',
    name: '성수 카페거리',
    hours: '영업중 · 오후 11:00까지',
    address: '서울 성동구 성수이로',
    pins: 9,
  },
  {
    id: '5',
    name: '연무장길 팝업존',
    hours: '영업중 · 오후 8:00까지',
    address: '서울 성동구 연무장길 24',
    pins: 14,
  },
  {
    id: '6',
    name: '어린이대공원',
    hours: '운영중 · 오후 10:00까지',
    address: '서울 광진구 능동로 216',
    pins: 5,
  },
  {
    id: '7',
    name: '건대 커먼그라운드',
    hours: '영업중 · 오후 10:00까지',
    address: '서울 광진구 아차산로 200',
    pins: 11,
  },
  {
    id: '8',
    name: '송정제방길',
    hours: '운영중 · 24시간 이용 가능',
    address: '서울 성동구 송정동 73-448',
    pins: 4,
  },
  {
    id: '9',
    name: '성수 수제화거리',
    hours: '영업중 · 오후 9:00까지',
    address: '서울 성동구 연무장7길',
    pins: 7,
  },
  {
    id: '10',
    name: '서울숲 북쪽 산책로',
    hours: '운영중 · 24시간 이용 가능',
    address: '서울 성동구 서울숲2길',
    pins: 10,
  },
] as const;

const angles = [320, 90, 270, 90, 180];

export default function Recommend() {
  const padding = useResponsivePadding();
  const [mode, setMode] = useState<CrowdFilter>('relaxed');
  const relaxed = mode === 'relaxed';
  const backgroundColors = relaxed
    ? (['#FFFDF3', '#F3FCEB', '#E8F7FC'] as const)
    : (['#FFFDF3', '#FFF3E9', '#FFECEF'] as const);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>추천 장소</Text>
      </View>
      <View style={s.content}>
        <View style={[s.intro, { paddingHorizontal: padding }]}>
          <Text style={s.kicker}>취향과 현재 위치를 반영했어요</Text>
          <View style={s.titleRow}>
            <Text style={s.title}>오늘의 장소 추천</Text>
            <View style={s.updateMeta}>
              <View style={s.updateDot} />
              <Text style={s.updateText}>16분 전 업데이트</Text>
            </View>
          </View>

          <CrowdFilterToggle value={mode} onChange={setMode} style={s.filterToggle} />
        </View>

        <LinearGradient colors={backgroundColors} locations={[0, 0.48, 1]} style={s.listGradient}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={s.list}>
            {recommendations.map((place) => (
              <View key={place.id} style={s.cardFrame}>
                <Pressable onPress={() => router.push(`/place/${place.id}`)} style={s.card}>
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
                    감지카메라 외 {Math.max(place.pins - 1, 1)}명이 핀을 업로드했습니다
                  </Text>
                  <View style={s.angleRow}>
                    {angles.map((angle, angleIndex) => (
                      <View
                        key={`${place.id}-${angleIndex}`}
                        style={[
                          s.angleRing,
                          { borderColor: relaxed ? color.pin.relaxed.strong : color.pin.wagle.soft },
                        ]}
                      >
                        <Text style={s.angleText}>{angle}°</Text>
                      </View>
                    ))}
                    <Text style={s.more}>+{place.pins}</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
}

const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.14,
  shadowRadius: 10,
  elevation: 5,
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: layout.headerHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { ...type.label, color: colors.gray600 },
  content: {
    flex: 1,
    paddingBottom: spacing.x3,
  },
  intro: {
    paddingTop: spacing.x12,
    paddingBottom: spacing.x4,
    backgroundColor: colors.white,
  },
  kicker: { ...type.caption, color: colors.gray600 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.x1 },
  title: { ...type.h2, color: colors.dark },
  updateMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.x1, marginLeft: spacing.x2 },
  updateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4A90E2' },
  updateText: { fontSize: 10, lineHeight: 15, color: colors.gray400 },
  filterToggle: { marginTop: spacing.x2 },
  listGradient: {
    flex: 1,
    marginHorizontal: spacing.x3,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.72)',
  },
  list: {
    gap: spacing.x4,
    paddingHorizontal: spacing.x2,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x5,
  },
  cardFrame: { borderRadius: radius.card },
  card: {
    minHeight: 172,
    padding: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  placeCopy: { flex: 1 },
  placeName: { ...type.title, color: colors.dark },
  hours: { ...type.caption, color: colors.gray600, marginTop: spacing.x1 },
  address: { ...type.caption, color: colors.gray400, marginTop: 1 },
  rule: { width: 56, height: 1, backgroundColor: colors.gray200, marginVertical: spacing.x3 },
  pinMessage: { ...type.caption, color: colors.gray400 },
  angleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: spacing.x2 },
  angleRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    backgroundColor: colors.white,
  },
  angleText: { fontSize: 8, lineHeight: 11, color: colors.gray600 },
  more: { ...type.caption, color: colors.gray600, marginLeft: spacing.x1 },
});
