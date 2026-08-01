import { StyleSheet } from 'react-native';
import { APP_TAB_BAR_HEIGHT } from '@/components/common/AppTabBar';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 게시글 상세 화면 전용 스타일.
 * 화면 조각(헤더 · 메뉴 · 본문 · 모달)이 모두 여기서 가져다 쓴다.
 */

/** 목업 시안 기준 그림자. 테마의 `elevation.card`보다 조금 더 진하다. */
/**
 * 3D 일러스트 영상의 배경색.
 *
 * 영상은 알파 채널이 없어 배경이 사각형으로 그대로 보인다. 카드를 영상과 같은 색으로
 * 맞춰야 경계가 사라진다. 코인 영상에서 추출한 값이며, 새 일러스트 영상도 이 색을 배경으로
 * 내보낸다. 순백(`#FFFFFF`)보다 파랑이 미세하게 높다.
 */
const ILLUSTRATION_BACKGROUND = '#FAFAFF';

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
  body: { flex: 1 },
  /** 스크롤 내용. 아래 고정 영역이 자리를 차지하므로 탭바 높이를 더하지 않는다. */
  content: { paddingBottom: spacing.x6 },
  /**
   * 늘 보이는 행동 영역.
   *
   * 스크롤 내용과 겹치지 않도록 흰 바탕을 깔고 위쪽에 경계를 둔다. 아래 여백은 떠 있는
   * 탭바 높이만큼 화면에서 넣어 준다.
   */
  actionBar: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x4,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },

  /* 헤더 오른쪽 자리 — 내 핀이면 메뉴, 남의 핀이면 신고. 헤더 자체는 공용 컴포넌트가 그린다. */
  headerButton: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
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
  /**
   * 서버가 준 영상. 프레임을 그대로 채운다.
   *
   * 촬영을 이 프레임 비율로 받으므로 잘라낼 것이 없다. 비율이 어긋나는 영상이
   * 들어오면 `contentFit="cover"`가 가운데를 기준으로 맞춘다.
   *
   * 너비·높이를 `100%`로 명시해야 한다. 웹의 `<video>`는 replaced element라서
   * 크기가 `auto`면 `left`·`right`로 늘어나지 않고 고유 너비를 쓰며 왼쪽에 붙는다.
   */
  videoPlayer: { width: '100%', height: '100%' },

  /**
   * 시안 영상 전용 배치. 프레임보다 크게 잡아 아래에 붙이고 위를 잘라낸다.
   *
   * 시안이 16:9 가로 영상이고 위쪽에 워터마크가 있어서 필요한 보정이다.
   * 실제 촬영 영상에는 적용하지 않는다 — 그쪽은 프레임 비율로 들어오므로
   * 확대하면 오히려 화면이 잘린다.
   *
   * 높이 160%는 프레임 기준이라 아래 62.5%만 보이고 위 37.5%가 잘린다.
   * 넘친 부분은 `videoFrame`의 `overflow: hidden`이 자른다.
   * 시안이 바뀌어 잘리는 양을 조절할 때만 이 값을 건드린다.
   */
  placeholderVideoPlayer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '100%',
    height: '160%',
  },

  /**
   * 소리 켜기·끄기 버튼. 영상 위 우측 하단에 얹는다.
   *
   * 블러 위에 와야 눌리므로 `videoFrame`에서 블러보다 뒤에 그린다.
   * 배경은 밝은 화면에서도 아이콘이 보이도록 반투명 검정을 깐다.
   */
  muteToggle: {
    position: 'absolute',
    right: spacing.x4,
    bottom: spacing.x4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,.45)',
  },

  /* 본문 시트 */
  detailSheet: {
    /**
     * 영상 위로 **모서리 반경만큼** 올라온다.
     *
     * 이 값이 반경보다 작으면 곡선이 끝나기 전에 영상의 아래 직선이 지나가, 둥근 모서리가
     * 중간에서 잘려 보인다. 8px일 때 그랬다. 반경과 같게 두면 곡선이 끝나는 지점과 영상의
     * 아래 끝이 정확히 맞닿아 이어진다.
     */
    marginTop: -radius.hero,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x5,
    paddingBottom: spacing.x6,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.white,
  },

  /* 작성자 프로필(뷰 각도 링 · 닉네임 · 상세위치·업로드 시각) + 채팅 버튼 줄 */
  authorRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  /** 링은 각도별 이미지라 테두리를 그리지 않고 이미지를 깔고 그 위에 숫자를 얹는다. */
  authorCopy: { flex: 1, marginLeft: spacing.x3 },
  authorName: { ...type.h3, color: colors.dark },
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
  placeName: { ...type.h2, color: colors.dark, marginTop: spacing.x4 },
  /**
   * 장소명 아래 줄. 주소가 있던 자리다.
   *
   * 장소명과 한 덩어리로 읽혀야 해서 거의 붙인다. 글자 크기가 24 → 16으로 크게 떨어져
   * 간격을 주지 않아도 두 줄이 구분된다.
   */
  detailLocation: { ...type.body, color: colors.gray400, marginTop: spacing.x1 },
  /** 모양은 CrowdLevelBadge가 갖고 있고 여기서는 배치만 준다. */
  crowdBadge: { alignSelf: 'flex-start', marginTop: spacing.x2 },
  /**
   * 장소 정보와 본문을 가르는 선.
   *
   * 아래를 위보다 좁힌다. 선 아래 글은 선이 이끄는 내용이라 붙어 있어야 한 묶음으로 읽힌다.
   * 위는 앞 블록과 떨어뜨리는 자리라 그대로 둔다.
   */
  rule: {
    height: 1,
    backgroundColor: colors.gray200,
    marginTop: spacing.x5,
    marginBottom: spacing.x4,
  },
  memo: { ...type.body, color: colors.gray400 },
  tags: { flexDirection: 'row', gap: spacing.x4, marginTop: spacing.x3 },
  tag: { ...type.small, color: colors.blue },

  /* 내 핀 하단 액션 */
  ownerFooter: { flexDirection: 'row', gap: spacing.x2 },
  footerButton: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  leaveButton: { backgroundColor: colors.dark },
  leaveButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.lime },
  goChatButton: { backgroundColor: '#D9ED76' },
  goChatButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },

  /* 미열람 안내 */
  watchArea: {},
  watchTitle: { ...type.title, color: colors.dark },
  /**
   * 제목에 딸린 설명이라 붙여 두고 한 단계 작게 쓴다.
   *
   * 여백을 0으로 둔다. 제목(18/26)과 이 줄(14/22)의 행간만으로 이미 6px쯤 떠 있어서,
   * 값을 더 주면 두 줄이 갈라져 보인다.
   */
  watchHint: { ...type.small, color: colors.gray400 },
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
  ratingArea: {},
  selectedRating: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#A3A78F' },
  ratingTitle: { ...type.title, color: colors.dark },
  ratingHint: { ...type.small, color: colors.gray600, marginTop: spacing.x1 },
  ratingError: { ...type.small, color: colors.danger, marginTop: spacing.x3 },
  ratingButtons: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x4 },
  ratingButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  ratingButtonBusy: { opacity: 0.6 },
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
  /* 아래에 붙는 시트 — 결제 확인 */
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(40,38,38,.45)' },
  /** 시트 위 빈 자리. 여기를 누르면 닫힌다. */
  sheetDismissArea: { flex: 1 },
  sheet: {
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x2,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: ILLUSTRATION_BACKGROUND,
  },
  /** 손잡이를 넉넉히 감싸 손가락이 닿는 자리를 넓힌다. */
  sheetHandleArea: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing.x3 },
  sheetHandle: { width: 56, height: 5, borderRadius: radius.pill, backgroundColor: colors.gray200 },
  sheetTitle: { ...type.title, alignSelf: 'flex-start', color: colors.dark },
  sheetCaption: { ...type.caption, alignSelf: 'flex-start', color: colors.gray400 },

  /* 채팅 요청 모달 — 가운데 상자 */
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
    backgroundColor: ILLUSTRATION_BACKGROUND,
    ...shadow,
  },
  modalTitle: { ...type.label, color: colors.dark, fontWeight: '600' },
  modalCaption: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },
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
  /** 비율 처리는 IllustrationVideo의 `contentFit`이 맡으므로 크기만 준다. */
  coinVideo: { width: 200, height: 200, marginTop: spacing.x4 },
  payError: { ...type.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.x3 },
  payButton: { alignSelf: 'stretch' },
  payButtonBusy: { opacity: 0.6 },
  payMessage: {
    ...type.body,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.dark,
    marginTop: spacing.x2,
    marginBottom: spacing.x5,
  },
  chatModalCard: {
    width: '100%',
    padding: spacing.x6,
    borderRadius: radius.lg,
    backgroundColor: ILLUSTRATION_BACKGROUND,
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
  chatStartBusy: { opacity: 0.6 },
  chatRequestError: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.x3,
  },
});
