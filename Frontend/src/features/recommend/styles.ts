import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 추천 장소 화면 전용 스타일.
 *
 * 화면 조각(머리말 · 목록 · 카드)이 모두 여기서 가져다 쓴다.
 */

/** 카드 그림자. 시안 기준이라 테마의 `elevation.card`보다 조금 진하다. */
const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.14,
  shadowRadius: 10,
  elevation: 5,
};

export const recommendStyles = StyleSheet.create({
  /* 화면 골격 */
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: layout.headerHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { ...type.label, color: colors.gray600 },
  content: { flex: 1, paddingBottom: spacing.x3 },

  /* 머리말 — 안내 문구와 계열 토글 */
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

  /* 목록 */
  listGradient: {
    flex: 1,
    marginHorizontal: spacing.x3,
    borderRadius: radius.hero,
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
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  stateText: { ...type.small, color: colors.gray600 },

  /* 카드 */
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
  /* 아직 핀이 없는 장소 — 작성으로 유도한다 */
  emptyPins: {
    marginTop: spacing.x3,
    paddingVertical: spacing.x4,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  emptyPinsText: { ...type.caption, color: colors.gray400 },
  writeLink: { ...type.h3, color: colors.dark, marginTop: spacing.x2 },
  more: { ...type.caption, color: colors.gray600, marginLeft: spacing.x1 },

  /* ---------------------------------------------------------------- *
   * 상세 — 지도 · 기본정보 · 영상핀 목록
   * ---------------------------------------------------------------- */

  /** 카드가 흰색이라 바탕은 옅은 회색이다. 흰 배경에 두면 카드 경계가 사라진다. */
  detailSafe: { flex: 1, backgroundColor: colors.gray100 },
  detail: { paddingBottom: spacing.x10 },
  /** 카드 영역. 지도만 여백 없이 폭을 다 쓰므로 여백은 이 안쪽에서 준다. */
  detailBody: { gap: spacing.x3, paddingHorizontal: spacing.x4, paddingTop: spacing.x4 },
  /** 지도는 좌우로 붙는다. 위치를 보여주는 자리라 이 높이면 충분하다. */
  map: { height: 260, borderRadius: 0 },
  mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray200 },

  /* 기본정보 카드 */
  infoCard: { padding: spacing.x5, borderRadius: radius.hero, backgroundColor: colors.white },
  infoName: { ...type.h2, color: colors.dark },
  infoText: { ...type.body, color: colors.gray400, marginTop: spacing.x1 },

  /* 요일별 혼잡도 */
  chart: { marginTop: spacing.x5 },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { ...type.label, fontWeight: '600', color: colors.dark },
  chartMeta: { ...type.caption, color: colors.gray400 },
  chartEmpty: { ...type.caption, color: colors.gray400, marginTop: spacing.x4 },
  chartBody: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.x5 },
  axisLabels: { width: 30, justifyContent: 'space-between', paddingVertical: 2 },
  axisText: { fontSize: 10, lineHeight: 14, color: colors.gray400 },
  /** 폭·높이는 `CrowdWeekChart`가 계산해 넣는다. */
  plot: { position: 'relative', overflow: 'visible' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.gray200,
  },
  /** 오늘 자리를 짚는 세로 띠. 아래 요일 칩과 이어 보이도록 아래로 조금 더 내려간다. */
  activeBand: {
    position: 'absolute',
    top: -6,
    bottom: -14,
    width: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  plotFill: { position: 'absolute', left: 0, right: 0, top: 24, bottom: 0 },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
    transformOrigin: 'left center' as never,
  },
  dot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  dotActive: {
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.lime,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltip: {
    position: 'absolute',
    top: -28,
    minWidth: 48,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.dark,
  },
  tooltipText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: colors.white },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.x4,
    paddingLeft: 30,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dayChipActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.gray600 },
  dayTextActive: { color: colors.dark, fontWeight: '700' },

  /* 영상핀 카드 */
  pinList: { gap: spacing.x3 },
  pinCard: { padding: spacing.x4, borderRadius: radius.hero, backgroundColor: colors.white },
  pinAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  pinAuthorCopy: { flex: 1 },
  pinAuthorName: { ...type.label, fontWeight: '600', color: colors.dark },
  pinTime: { ...type.caption, color: colors.gray400 },
  pinBody: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.x3, marginTop: spacing.x3 },
  pinThumbnail: { width: 128, minHeight: 128, borderRadius: radius.md },
  pinCopy: { flex: 1, minWidth: 0 },
  pinMemo: { ...type.small, color: colors.gray600 },
  pinMore: { ...type.small, color: colors.gray400 },
  pinTags: { flexDirection: 'row', gap: spacing.x1, marginTop: spacing.x2, overflow: 'hidden' },
  pinTag: {
    maxWidth: '45%',
    height: 28,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x2,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  pinTagText: { ...type.caption, flexShrink: 1, color: colors.gray600 },
});
