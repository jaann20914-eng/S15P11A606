import { StyleSheet } from 'react-native';
import { APP_TAB_BAR_HEIGHT } from '@/components/common/AppTabBar';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 게시글 상세 화면 전용 스타일.
 * 화면 조각(헤더 · 메뉴 · 본문 · 모달)이 모두 여기서 가져다 쓴다.
 */

/** 목업 시안 기준 그림자. 테마의 `elevation.card`보다 조금 더 진하다. */
const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.16,
  shadowRadius: 12,
  elevation: 6,
};
export const pinDetailStyles = StyleSheet.create({
  /* 화면 골격 */
  safe: { flex: 1, backgroundColor: colors.white },
  stateArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingBottom: APP_TAB_BAR_HEIGHT + spacing.x10,
  },
  content: { paddingBottom: APP_TAB_BAR_HEIGHT + spacing.x10 },

  /* 헤더 */
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.title, color: colors.dark },
  reportButton: {
    minWidth: 52,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
  },
  reportText: { ...type.caption, color: colors.gray600 },

  /* 내 핀 메뉴 */
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 },
  menuPopover: {
    position: 'absolute',
    zIndex: 10,
    top: 52,
    right: 12,
    width: 124,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    ...shadow,
  },
  menuRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
  },
  menuRule: { height: 1, backgroundColor: colors.gray200 },
  menuText: { ...type.label, color: colors.gray600 },

  /* 영상 */
  videoFrame: { height: 294, position: 'relative', overflow: 'hidden', backgroundColor: colors.gray200 },
  videoImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  /* 본문 시트 */
  detailSheet: {
    marginTop: -8,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x6,
    paddingBottom: spacing.x8,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.white,
  },

  /* 작성자 프로필(뷰 각도 링 · 닉네임 · 상세위치·업로드 시각) + 채팅 버튼 줄 */
  authorRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  /** 링은 각도별 이미지라 테두리를 그리지 않고 이미지를 깔고 그 위에 숫자를 얹는다. */
  authorCopy: { flex: 1, marginLeft: spacing.x3 },
  authorName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },
  authorMeta: { ...type.small, color: colors.gray400 },
  chatButton: {
    height: 40,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  chatPending: { backgroundColor: colors.gray400 },
  chatText: { ...type.label, color: colors.white, fontWeight: '600' },

  /* 장소 */
  placeName: { ...type.h3, fontWeight: '700', color: colors.dark, marginTop: spacing.x8 },
  address: { ...type.body, color: colors.gray400, marginTop: spacing.x2 },
  /** 모양은 CrowdLevelBadge가 갖고 있고 여기서는 배치만 준다. */
  crowdBadge: { alignSelf: 'flex-start', marginTop: spacing.x3 },
  rule: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.x6 },
  memo: { ...type.body, color: colors.gray400 },
  tags: { flexDirection: 'row', gap: spacing.x4, marginTop: spacing.x3 },
  tag: { ...type.small, color: colors.blue },

  /* 내 핀 하단 액션 */
  ownerFooter: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x10 },
  footerButton: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  leaveButton: { backgroundColor: colors.dark },
  leaveButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.lime },
  goChatButton: { backgroundColor: '#D9ED76' },
  goChatButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },

  /* 미열람 안내 */
  watchArea: { marginTop: spacing.x12 },
  watchTitle: { ...type.title, color: colors.dark },
  watchHint: { ...type.body, color: colors.gray400, marginTop: spacing.x2 },
  watchButton: { marginTop: spacing.x4 },
  primaryDark: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  primaryDarkText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.lime },

  /* 평가 */
  ratingArea: { marginTop: spacing.x10 },
  selectedRating: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#A3A78F' },
  ratingTitle: { ...type.label, color: colors.dark, fontWeight: '600' },
  ratingHint: { ...type.caption, color: colors.gray600, marginTop: spacing.x1 },
  ratingButtons: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x4 },
  ratingButton: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  helpfulButton: { backgroundColor: colors.lime },
  missButton: { backgroundColor: colors.gray100 },
  helpfulText: { ...type.label, color: colors.dark, fontWeight: '600' },
  missText: { ...type.label, color: colors.gray600, fontWeight: '600' },
  reward: {
    marginTop: spacing.x4,
    padding: spacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderRadius: radius.lg,
    backgroundColor: colors.limeSoft,
  },
  rewardCoin: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  rewardTitle: { ...type.label, color: colors.dark, fontWeight: '600' },
  rewardText: { ...type.caption, color: colors.gray600, marginTop: 2 },

  /* 결제 · 채팅 요청 모달 */
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    backgroundColor: 'rgba(255,255,255,.68)',
  },
  modalCard: {
    width: '100%',
    padding: spacing.x5,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow,
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalTitle: { ...type.label, color: colors.dark, fontWeight: '600' },
  modalCaption: { fontSize: 10, lineHeight: 15, color: colors.gray400, marginTop: spacing.x1 },
  modalClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D3D6DA',
  },
  payPanel: {
    marginTop: spacing.x4,
    padding: spacing.x4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.md,
  },
  coinImage: { width: 76, height: 76, resizeMode: 'contain' },
  payError: { ...type.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.x3 },
  payButton: { alignSelf: 'stretch' },
  payButtonBusy: { opacity: 0.6 },
  payMessage: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.dark,
    marginVertical: spacing.x4,
  },
  chatModalCard: {
    width: '100%',
    padding: spacing.x6,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow,
  },
  chatIllustration: { width: 150, height: 150, resizeMode: 'contain', alignSelf: 'center' },
  chatStart: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.md,
  },
  chatStartText: { ...type.label, color: '#91A700', fontWeight: '600' },
});
