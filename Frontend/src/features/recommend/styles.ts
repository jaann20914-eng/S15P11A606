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

/** 상세 지도 칸 높이. 확대 레벨 계산이 같은 값을 써야 해 상수로 둔다. */
export const RECOMMEND_MAP_HEIGHT = 260;

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
  intro: { paddingTop: spacing.x6, paddingBottom: spacing.x4 },
  /** 제목과 토글을 한 줄에 둔다. 토글은 오른쪽 끝에 붙는다(시안). */
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.h2, color: colors.dark },
  /** 제목 아래 한 줄. 지금 어느 계열을 보고 있는지 말로도 알린다. */
  subtitle: { ...type.small, color: colors.gray400, marginTop: spacing.x2 },
  updateMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.x1, marginLeft: spacing.x2 },
  updateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4A90E2' },
  updateText: { ...type.caption, color: colors.gray400 },
  filterToggle: { marginTop: spacing.x2 },

  /* 화면 바탕 — 머리말부터 카드까지 한 덩어리로 색을 깐다 */
  screenGradient: { flex: 1 },

  /* ---------------------------------------------------------------- *
   * 캐러셀 — 장소 한 곳이 카드 한 장
   * ---------------------------------------------------------------- */

  pagerArea: { flex: 1 },
  /**
   * 카드가 놓이는 칸. **너비는 화면이 정한다**(넘긴 만큼이 곧 한 장이라 화면 폭이어야 한다).
   * 여백은 칸이 아니라 여기 안쪽에서 준다.
   */
  pagerSlot: { paddingHorizontal: spacing.x3, paddingBottom: spacing.x3 },
  pageCard: {
    flex: 1,
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: colors.white,
    ...shadow,
  },
  /** 장소 이름 줄. 지도 위에 두어 어디 이야기인지가 먼저 읽힌다. */
  pageHead: { paddingHorizontal: spacing.x4, paddingTop: spacing.x4, paddingBottom: spacing.x3 },
  pageHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageName: { ...type.title, color: colors.dark, flexShrink: 1 },
  pageAddress: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  /** 핀 목록. 카드 안에서 따로 스크롤한다 — 지도는 위에 고정으로 남는다. */
  pagePins: { flex: 1 },
  pagePinsContent: { padding: spacing.x3 },
  pageState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /**
   * 자리 표시 점. 지금 자리는 길쭉한 막대로 늘여 한눈에 보이게 한다.
   *
   * 장소가 하나뿐이면 점도 하나다 — 넘길 곳이 없다는 뜻이라 숨기지 않고 그대로 둔다.
   */
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingVertical: spacing.x3,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray200 },
  dotOn: { width: 24, backgroundColor: colors.limeControl },
  dotOnWagle: { width: 24, backgroundColor: colors.crowdedActive },

  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  stateText: { ...type.small, color: colors.gray600 },

  /*
    추천할 장소가 없을 때.

    목록이 들어갈 자리를 그대로 쓴다. 위아래로 가운데에 두어 "여기가 비었다"가 아니라
    "여기서 할 일이 있다"로 읽히게 한다.
  */
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.x8,
  },
  /**
   * 3D 일러스트. 문구보다 먼저 눈에 들어오되 화면을 다 먹지 않을 크기로 둔다.
   *
   * 원본이 104px이라 그보다 크게 그리면 흐려진다. 더 키우려면 원본을 2~3배로 다시 받아야 한다.
   */
  emptyIllustration: { width: 96, height: 96 },
  emptyTitle: { ...type.h3, color: colors.dark, marginTop: spacing.x4 },
  emptyBody: {
    ...type.small,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.x2,
  },
  /** 이 상태에서 가장 쓸모 있는 행동. 눌러야 할 것이 하나임을 색으로 알린다. */
  emptyPrimary: {
    height: 48,
    paddingHorizontal: spacing.x6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.x5,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  emptyPrimaryText: { ...type.label, color: colors.lime, fontWeight: '600' },
  /** 다시 조회. 바탕 없이 두어 위 버튼과 무게가 겹치지 않게 한다. */
  emptySecondary: {
    height: 40,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.x1,
  },
  emptySecondaryText: { ...type.caption, color: colors.gray400, fontWeight: '600' },

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
   * 상세 — 지도 · 기본정보 · 핀 목록
   * ---------------------------------------------------------------- */

  /** 카드가 흰색이라 바탕은 옅은 회색이다. 흰 배경에 두면 카드 경계가 사라진다. */
  detailSafe: { flex: 1, backgroundColor: colors.gray100 },
  detail: { paddingBottom: spacing.x10 },
  /** 지도가 스크롤 밖에 고정되면서, 스크롤은 남은 높이를 가져야 한다. */
  detailScroll: { flex: 1 },
  /** 카드 영역. 지도만 여백 없이 폭을 다 쓰므로 여백은 이 안쪽에서 준다. */
  detailBody: { gap: spacing.x3, paddingHorizontal: spacing.x4, paddingTop: spacing.x4 },
  /** 지도는 좌우로 붙는다. 위치를 보여주는 자리라 이 높이면 충분하다. */
  map: { height: RECOMMEND_MAP_HEIGHT, borderRadius: 0 },
  /** 지도 칸을 가득 채운다. 칸 크기는 바깥 `map`이 정하고, 지도는 그걸 따라간다. */
  mapFill: { flex: 1, height: undefined, borderRadius: 0 },
  mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray200 },

  /* 기본정보 카드 */
  infoCard: { padding: spacing.x5, borderRadius: radius.hero, backgroundColor: colors.white },
  infoName: { ...type.h2, color: colors.dark },
  infoText: { ...type.body, color: colors.gray400, marginTop: spacing.x1 },

  /** 요일별 혼잡도 그래프 자리. 그래프 자체는 공용 컴포넌트가 그린다. */
  chartSlot: { marginTop: spacing.x5 },

  /* 핀 목록 */
  pinList: { gap: spacing.x3 },
});
