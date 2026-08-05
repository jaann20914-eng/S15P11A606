import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 마이페이지 전용 스타일.
 *
 * 네 화면(요약 · 작성한 핀 · 크레딧 내역 · 닉네임 수정)이 헤더와 목록 카드를 공유한다.
 * 같은 값을 화면마다 복사하지 않도록 여기 한 곳에 둔다.
 */
export const mypageStyles = StyleSheet.create({
  /* 화면 골격 */
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },

  /* 헤더 — 뒤로 가기가 있는 하위 화면용 */
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.label, fontWeight: '600', color: colors.gray600 },

  /** 탭 첫 화면 헤더의 오른쪽 자리. 헤더 자체는 공용 `ScreenHeader`가 그린다. */
  settingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  /* 뷰 신뢰도 요약 카드 */
  summaryContent: { paddingHorizontal: 18, paddingTop: spacing.x5, paddingBottom: spacing.x6 },
  /** 아래 활동 카드와 같은 테두리를 쓴다. 시안에서 두 카드는 같은 무게로 놓여 있다. */
  summaryCard: {
    padding: spacing.x4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  trustRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
    paddingHorizontal: spacing.x2,
  },
  trustCopy: { flex: 1 },
  eyebrow: { ...type.small, color: colors.gray400 },
  trustValue: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.dark,
  },
  /** 두 줄로 접히는 것을 전제로 한 줄 길이를 잡는다. 카드 폭을 다 쓰면 링과 붙어 보인다. */
  trustHelp: {
    ...type.small,
    color: colors.gray400,
    marginTop: spacing.x1,
  },
  /**
   * 보유 크레딧과 오늘 핀.
   *
   * 아래 이 달의 활동과 같은 방식이다 — 선을 긋는 대신 실금만큼 띄워 흰 바탕이 비치게 하고,
   * 바깥 모서리만 둥글려 한 카드를 갈라 놓은 것처럼 보이게 한다.
   */
  metrics: { flexDirection: 'row', gap: 3, marginTop: spacing.x3 },
  metric: {
    flex: 1,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F9D5',
  },
  metricFirst: { borderTopLeftRadius: radius.card, borderBottomLeftRadius: radius.card },
  metricLast: { borderTopRightRadius: radius.card, borderBottomRightRadius: radius.card },
  metricLabel: { ...type.small, color: colors.gray600 },
  metricValue: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.gray600,
    marginTop: 2,
  },

  /* 활동 달력 카드 */
  /**
   * 달력과 이 달의 활동을 위아래로 쌓는다.
   *
   * 예전에는 달력을 왼쪽 68%에, 숫자를 오른쪽에 세로로 두었다. 그러면 달력 칸이 작아져 어느
   * 날에 올렸는지 알아보기 어렵고, 숫자 세 줄은 글줄로 읽혀 눈에 띄지 않았다. 시안대로 달력을
   * 폭 전체로 넓히고 숫자는 아래에 나란히 놓는다.
   */
  activityCard: {
    marginTop: spacing.x5,
    padding: spacing.x4,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  /** 다른 달을 불러오는 중. 눌린 것이 반영되고 있다는 표시. */
  activityCardLoading: { opacity: 0.55 },
  /**
   * 요일 줄과 칸을 함께 묶은 자리.
   *
   * 카드 폭을 다 쓰면 칸이 지나치게 커져 한 달이 화면을 가득 메운다. 시안처럼 가운데에 두고
   * 폭만 좁힌다. 요일 줄이 같은 폭을 쓰므로 글자와 칸의 열이 어긋나지 않는다.
   */
  calendar: { width: '76%', alignSelf: 'center', marginTop: spacing.x3 },
  monthRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  month: { ...type.title, color: colors.dark },
  weekRow: { flexDirection: 'row' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...type.caption,
    color: colors.gray600,
  },
  heatmap: { marginTop: spacing.x2 },
  heatmapRow: { flexDirection: 'row' },
  /**
   * 칸 한 개.
   *
   * 퍼센트 폭은 Yoga에서 높이가 0으로 접혀 앱에서 칸이 보이지 않는다. 주 단위 행 안에서
   * `flex`로 폭을 나눠 받고 `aspectRatio`로 정사각형을 만들면 웹과 앱이 같게 계산된다.
   */
  cell: { flex: 1, aspectRatio: 1 },
  cellBlank: { backgroundColor: 'transparent' },
  cellEmpty: { backgroundColor: '#F3F3F3' },
  cellLow: { backgroundColor: '#EFF8B5' },
  cellMid: { backgroundColor: '#D6ED60' },
  cellHigh: { backgroundColor: colors.lime },
  /**
   * 이 달의 활동.
   *
   * 세 칸이지만 하나의 카드로 읽혀야 한다. 바깥 모서리만 둥글게 두고 맞닿는 안쪽은 각지게
   * 두면, 한 덩어리를 살짝 갈라 놓은 모습이 된다. 칸마다 모서리를 다 둥글리면 따로 놓인
   * 배지 세 개로 보인다. 사이는 실금만큼만 띄운다.
   */
  monthStats: { flexDirection: 'row', gap: 3, marginTop: spacing.x5 },
  monthStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x2,
    backgroundColor: '#F3F9D5',
  },
  monthStatFirst: { borderTopLeftRadius: radius.hero, borderBottomLeftRadius: radius.hero },
  monthStatLast: { borderTopRightRadius: radius.hero, borderBottomRightRadius: radius.hero },
  monthStatLabel: { ...type.caption, color: colors.gray600 },
  monthStatValue: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.gray600,
    marginTop: spacing.x1,
  },

  /* 메뉴 목록과 로그아웃 */
  sectionTitle: { ...type.title, color: colors.dark, marginTop: spacing.x10, marginBottom: spacing.x2 },
  menuList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.gray200 },
  menu: { height: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  menuText: { ...type.body, flex: 1, color: colors.dark },
  logout: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.x4 },
  logoutText: { ...type.caption, color: colors.gray400 },

  /* 목록 화면 공통 (작성한 핀 · 크레딧 내역) */
  content: {
    flex: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x5,
    paddingBottom: spacing.x4,
  },
  listCard: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  list: { paddingHorizontal: spacing.x4, paddingBottom: spacing.x4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.small, color: colors.gray400 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },

  /* 작성한 핀 */
  pinSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
    marginTop: spacing.x3,
    marginBottom: spacing.x5,
  },
  pinSummary: { ...type.title, color: colors.dark },
  pinCount: { ...type.body, color: colors.gray600 },
  pinRow: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    paddingVertical: spacing.x4,
  },
  timePill: {
    width: 72,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  time: { ...type.label, color: colors.gray600 },
  pinCopy: { flex: 1, minWidth: 0 },
  place: { ...type.label, fontWeight: '600', color: colors.dark },
  address: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
  pinState: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  pinStatePending: { color: '#348BF2', fontWeight: '600' },

  /* 크레딧 잔액 카드 */
  balanceCard: { height: 156, overflow: 'hidden', flexDirection: 'row', borderRadius: radius.hero },
  balanceCopy: { zIndex: 1, flex: 1, justifyContent: 'center', paddingLeft: spacing.x5 },
  balanceLabel: { ...type.caption, color: colors.gray600 },
  balanceValue: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.dark,
    marginTop: spacing.x1,
  },
  unit: { ...type.caption, fontWeight: '400', color: colors.gray600 },
  balanceHelp: { width: 185, ...type.caption, color: colors.gray600, marginTop: spacing.x2 },
  coinImage: { position: 'absolute', right: 0, top: 0, width: 138, height: 156, resizeMode: 'cover' },

  /* 크레딧 필터 */
  filterBar: {
    zIndex: 5,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.x8,
  },
  typeFilters: { flexDirection: 'row', gap: spacing.x2 },
  filterChip: {
    minWidth: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x3,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  filterChipActive: { borderColor: colors.dark, backgroundColor: colors.dark },
  filterText: { ...type.label, color: colors.gray400 },
  filterTextActive: { color: colors.white },
  periodWrap: { position: 'relative' },
  periodButton: {
    width: 76,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  periodText: { ...type.label, color: colors.gray400 },
  periodMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 76,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  periodOption: { height: 42, alignItems: 'center', justifyContent: 'center' },
  periodOptionText: { ...type.label, color: colors.gray600 },

  /* 크레딧 내역 줄 */
  /** 다음 페이지를 받는 중임을 알리는 목록 아래 스피너. */
  listFooter: { paddingVertical: spacing.x4 },
  creditListCard: { marginTop: spacing.x2 },
  creditRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  signBox: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnBox: { backgroundColor: colors.limeSoft },
  useBox: { backgroundColor: colors.gray100 },
  sign: { ...type.label, fontWeight: '700', color: colors.dark },
  creditCopy: { flex: 1 },
  creditTitle: { ...type.label, fontWeight: '600', color: colors.dark },
  creditMeta: { ...type.caption, color: colors.gray400, marginTop: 2 },
  amount: { ...type.label, fontWeight: '600', color: colors.dark },
  amountEarn: { color: '#8FA900' },

  /* 닉네임 수정 */
  nicknameContent: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.x10 },
  nicknameTitle: { ...type.h2, color: colors.dark },
  nicknameDescription: { ...type.body, color: colors.gray600, marginTop: spacing.x1 },
  inputShell: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.x12,
    paddingLeft: spacing.x4,
    paddingRight: spacing.x1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  inputShellChecked: { borderColor: colors.lime },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    paddingRight: spacing.x2,
    ...type.body,
    color: colors.dark,
  },
  checkButton: {
    minWidth: 88,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingHorizontal: spacing.x3,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
  },
  checkDisabled: { backgroundColor: colors.gray100 },
  checkedButton: { backgroundColor: colors.limeSoft },
  checkText: { ...type.label, fontWeight: '600', color: colors.dark },
  checkTextDisabled: { color: colors.gray400 },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.x2,
  },
  helper: { ...type.caption, color: colors.gray600 },
  helperSuccess: { color: colors.success, fontWeight: '500' },
  helperError: { color: colors.danger, fontWeight: '500' },
  count: { ...type.caption, color: colors.gray400 },
  saveButton: {
    height: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: colors.lime,
  },
  saveDisabled: { backgroundColor: '#E3F58A' },
  saveText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },
  saveTextDisabled: { color: colors.gray400 },
});
