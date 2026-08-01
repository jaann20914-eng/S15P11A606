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

  /* 아직 채우지 않은 자리 — 공용 컴포넌트를 가져다 끼운다 */
  placeholder: {
    marginTop: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    padding: spacing.x4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    backgroundColor: colors.gray100,
  },
  placeholderLabel: { ...type.label, fontWeight: '600', color: colors.gray600 },
  placeholderNote: { ...type.caption, textAlign: 'center', color: colors.gray400 },

  /* 영상핀 목록 */
  pinList: { gap: spacing.x3 },
});
