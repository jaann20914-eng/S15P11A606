import { useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

type CreditType = '전체' | '사용' | '적립';
type Period = '오늘' | '1주일' | '1달';
const rows = [
  { id: '1', title: '영상핀 평가 참여', time: '오늘 오후 2:14', amount: 1, type: '적립' as const, period: '오늘' },
  { id: '2', title: '성수 연무장길 영상 열람', time: '오늘 오후 1:52', amount: -3, type: '사용' as const, period: '오늘' },
  { id: '3', title: '채팅 요청 수락', time: '오늘 오후 7:03', amount: 5, type: '적립' as const, period: '오늘' },
  { id: '4', title: '채팅 요청 수락', time: '26.07.23 오후 7:03', amount: 5, type: '적립' as const, period: '1주일' },
  { id: '5', title: '서울숲 영상 열람', time: '26.07.12 오후 4:20', amount: -3, type: '사용' as const, period: '1달' },
];
const navItems = [
  { label: '홈', icon: 'map-outline', path: '/(tabs)/home', capture: false },
  { label: '추천', icon: 'sparkles-outline', path: '/(tabs)/recommend', capture: false },
  { label: '제보', icon: 'add', path: '/(tabs)/write', capture: true },
  { label: '채팅', icon: 'chatbubbles-outline', path: '/(tabs)/chat/sent', capture: false },
  { label: '마이', icon: 'person', path: '/(tabs)/mypage', capture: false },
] as const;

export default function Credits() {
  const [typeFilter, setTypeFilter] = useState<CreditType>('전체');
  const [period, setPeriod] = useState<Period>('오늘');
  const [periodOpen, setPeriodOpen] = useState(false);

  const visibleRows = useMemo(() => rows.filter(row => {
    const typeMatch = typeFilter === '전체' || row.type === typeFilter;
    const periodMatch = period === '1달' || (period === '1주일' ? row.period !== '1달' : row.period === '오늘');
    return typeMatch && periodMatch;
  }), [period, typeFilter]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.headerButton}><Ionicons name="chevron-back" size={24} color={colors.gray400}/></Pressable>
          <Text style={s.headerTitle}>크레딧 내역</Text>
          <View style={s.headerButton}/>
        </View>

        <View style={s.content}>
          <LinearGradient colors={['#F6FBD8', '#FBFCDC', '#F2F7BD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.balanceCard}>
            <View style={s.balanceCopy}>
              <Text style={s.balanceLabel}>보유 크레딧</Text>
              <Text style={s.balanceValue}>120 <Text style={s.unit}>크레딧</Text></Text>
              <Text style={s.balanceHelp}>영상 평가와 채팅 응답으로 적립할 수 있어요.</Text>
            </View>
            <Image source={require('../../../assets/images/credit-reward.png')} style={s.coinImage}/>
          </LinearGradient>

          <View style={s.filterBar}>
            <View style={s.typeFilters}>
              {(['전체', '사용', '적립'] as CreditType[]).map(item => (
                <Pressable key={item} onPress={() => setTypeFilter(item)} style={[s.filterChip, typeFilter === item && s.filterChipActive]}>
                  <Text style={[s.filterText, typeFilter === item && s.filterTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.periodWrap}>
              <Pressable onPress={() => setPeriodOpen(open => !open)} style={s.periodButton}>
                <Text style={s.periodText}>{period}</Text>
                <Ionicons name={periodOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.gray400}/>
              </Pressable>
              {periodOpen && <View style={s.periodMenu}>
                {(['오늘', '1주일', '1달'] as Period[]).filter(item => item !== period).map(item => (
                  <Pressable key={item} onPress={() => { setPeriod(item); setPeriodOpen(false); }} style={s.periodOption}>
                    <Text style={s.periodOptionText}>{item}</Text>
                  </Pressable>
                ))}
              </View>}
            </View>
          </View>

          <View style={s.listCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
              {visibleRows.map((row, index) => (
                <View key={row.id} style={[s.row, index < visibleRows.length - 1 && s.rowBorder]}>
                  <View style={[s.signBox, row.type === '적립' ? s.earnBox : s.useBox]}>
                    <Text style={s.sign}>{row.amount > 0 ? '+' : '−'}</Text>
                  </View>
                  <View style={s.rowCopy}>
                    <Text style={s.rowTitle}>{row.title}</Text>
                    <Text style={s.rowMeta}>{row.time} · {row.type}</Text>
                  </View>
                  <Text style={[s.amount, row.amount > 0 && s.amountEarn]}>{row.amount > 0 ? `+ ${row.amount}` : `- ${Math.abs(row.amount)}`}</Text>
                </View>
              ))}
              {visibleRows.length === 0 && <View style={s.empty}><Text style={s.emptyText}>조건에 맞는 내역이 없어요.</Text></View>}
            </ScrollView>
          </View>
        </View>

        <View style={s.bottomNav}>
          {navItems.map(item => (
            <Pressable key={item.label} onPress={() => router.replace(item.path)} style={s.navItem}>
              <View style={item.capture && s.captureButton}>
                <Ionicons name={item.icon} size={item.capture ? 30 : 21} color={item.label === '마이' ? colors.dark : item.capture ? colors.white : colors.gray400}/>
              </View>
              <Text style={[s.navLabel, item.label === '마이' && s.navActive, item.capture && s.captureLabel]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  header: { height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.x2, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.label, fontWeight: '600', color: colors.gray600 },
  content: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.x5, paddingBottom: spacing.x4 },
  balanceCard: { height: 156, overflow: 'hidden', flexDirection: 'row', borderRadius: radius.hero },
  balanceCopy: { zIndex: 1, flex: 1, justifyContent: 'center', paddingLeft: spacing.x5 },
  balanceLabel: { ...type.caption, color: colors.gray600 },
  balanceValue: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: colors.dark, marginTop: spacing.x1 },
  unit: { ...type.caption, fontWeight: '400', color: colors.gray600 },
  balanceHelp: { width: 185, ...type.caption, color: colors.gray600, marginTop: spacing.x2 },
  coinImage: { position: 'absolute', right: 0, top: 0, width: 138, height: 156, resizeMode: 'cover' },
  filterBar: { zIndex: 5, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.x8 },
  typeFilters: { flexDirection: 'row', gap: spacing.x2 },
  filterChip: { minWidth: 52, height: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.x3, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.pill, backgroundColor: colors.white },
  filterChipActive: { borderColor: colors.dark, backgroundColor: colors.dark },
  filterText: { ...type.label, color: colors.gray400 },
  filterTextActive: { color: colors.white },
  periodWrap: { position: 'relative' },
  periodButton: { width: 76, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x1, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.pill, backgroundColor: colors.white },
  periodText: { ...type.label, color: colors.gray400 },
  periodMenu: { position: 'absolute', top: 38, right: 0, width: 76, overflow: 'hidden', borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, backgroundColor: colors.white, shadowColor: colors.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: .12, shadowRadius: 8, elevation: 6 },
  periodOption: { height: 42, alignItems: 'center', justifyContent: 'center' },
  periodOptionText: { ...type.label, color: colors.gray600 },
  listCard: { flex: 1, overflow: 'hidden', marginTop: spacing.x2, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.lg, backgroundColor: colors.white },
  list: { paddingHorizontal: spacing.x4, paddingBottom: spacing.x4 },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  signBox: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  earnBox: { backgroundColor: colors.limeSoft },
  useBox: { backgroundColor: colors.gray100 },
  sign: { ...type.label, fontWeight: '700', color: colors.dark },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.label, fontWeight: '600', color: colors.dark },
  rowMeta: { ...type.caption, color: colors.gray400, marginTop: 2 },
  amount: { ...type.label, fontWeight: '600', color: colors.dark },
  amountEarn: { color: '#8FA900' },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.small, color: colors.gray400 },
  bottomNav: { height: 72, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.white },
  navItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500', color: colors.gray400, marginTop: spacing.x1 },
  navActive: { color: colors.dark, fontWeight: '600' },
  captureButton: { width: 54, height: 54, marginTop: -25, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 3, borderColor: colors.white, backgroundColor: '#D9ED76', shadowColor: colors.dark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: .18, shadowRadius: 8, elevation: 7 },
  captureLabel: { marginTop: spacing.x2 },
});
