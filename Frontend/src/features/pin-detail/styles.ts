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
 * 맞춰야 경계가 사라진다. 예전 코인 영상이 살짝 푸른 흰색(`#FAFAFF`)이라 그 값을 썼는데,
 * 새로 받은 영상들은 순백을 배경으로 내보내 흰색으로 맞췄다.
 *
 * 영상이 바뀌어 경계가 보이면 그 영상의 배경색을 여기에 다시 맞춘다.
 */
const ILLUSTRATION_BACKGROUND = colors.white;

const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.16,
  shadowRadius: 12,
  elevation: 6,
};
/** 사라짐 구간이 바 위로 걸치는 깊이. 이만큼 아래로 내려 겹친다. */
export const ACTION_FADE_DROP = 16;

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
  /**
   * 결제 시트가 열렸을 때 흐려질 묶음. 시트는 이 밖에 있어 또렷하게 남는다.
   *
   * 흐림 반경은 화면이 정한다(`useBackdropBlur`). `BlurView`가 아니라 `filter`를 쓰는 이유는
   * 스냅샷을 뜨지 않고 렌더 노드에 직접 걸려서 영상까지 함께 흐려지기 때문이다
   * (`PinDetailMedia` 주석 참고).
   */
  screenContent: { flex: 1 },
  body: { flex: 1 },
  /** 스크롤 내용. 아래 고정 영역이 자리를 차지하므로 탭바 높이를 더하지 않는다. */
  content: { paddingBottom: spacing.x6 },
  /**
   * 늘 보이는 행동 영역.
   *
   * 스크롤 내용과 겹치지 않도록 흰 바탕을 깔고 위쪽에 경계를 둔다. 아래 여백은 떠 있는
   * 탭바 높이만큼 화면에서 넣어 준다.
   */
  /**
   * 본문 위에 겹쳐 놓는다. 가려지는 만큼은 본문의 아래 여백으로 돌려준다.
   *
   * 바탕은 **불투명한 흰색**이다. 뒤가 비치게 두어 봤더니 본문 글이 버튼·안내 문구와 겹쳐
   * 읽기 어려웠다. 이 자리에는 눌러야 할 것과 그 설명이 모여 있어 뒤가 보이는 이득보다
   * 어수선해지는 손해가 크다. 경계선 대신 위에 짧은 그라데이션(`actionFade`)을 얹어
   * 내용이 사라지며 들어가게 한다.
   */
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    /* 위 여백을 좁혀 사라짐이 문구 가까이까지 내려오게 한다. */
    paddingTop: spacing.x2,
    backgroundColor: colors.white,
  },
  /**
   * 바 위에서 내용을 흰색으로 지워 간다. 높이는 한 줄 정도면 충분하다 — 더 늘리면 위쪽
   * 내용까지 흐려져 무엇이 적혀 있는지 알 수 없다.
   *
   * 바 위쪽으로 조금 내려 걸친다(`ACTION_FADE_DROP`). 딱 맞춰 두면 사라짐이 끝나는 선과
   * 바가 시작하는 선이 같은 자리에 놓여, 흐려지다 만 것처럼 보인다.
   */
  actionFade: { position: 'absolute', left: 0, right: 0, height: 44 },

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
    /*
      본문 시트가 영상 아래를 `radius.hero`만큼 덮고 올라온다. 그 값을 더하지 않으면 버튼이
      흰 바탕에 맞닿아 붙어 보인다. 덮이는 만큼을 먼저 비우고 그 위로 여백을 준다.
    */
    bottom: radius.hero + spacing.x4,
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
  /** 이미 떠난 핀. 눌러도 달라질 것이 없어 눌릴 수 있어 보이지 않게 둔다. */
  leaveButtonDone: { backgroundColor: colors.gray100 },
  leaveButtonTextDone: { color: colors.gray400 },
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
  /** 시트에 쓸 그림을 받는 동안. 눌리지 않는다는 것만 보이면 된다. */
  primaryDarkBusy: { opacity: 0.6 },

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
  /**
   * 나뭇잎이 떨어지는 자리.
   *
   * 아이콘 하나였을 때는 48이면 충분했지만, 지금은 잎이 떨어지는 움직임이 들어가서 그 크기로는
   * 무엇이 지나갔는지 알아볼 수 없다. 64까지만 키운다 — 더 키우면 옆 문구보다 그림이 커진다.
   * 영상이 모서리를 덮으므로 `overflow`로 잘라야 둥근 모서리가 남는다.
   */
  rewardCoin: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: ILLUSTRATION_BACKGROUND,
  },
  rewardTitle: { ...type.label, color: colors.dark, fontWeight: '600' },
  rewardText: { ...type.caption, color: colors.gray600, marginTop: 2 },

  /* 결제 · 채팅 요청 모달 */
  /* 아래에 붙는 시트 — 결제 확인 */
  /** 화면 위에 통째로 덮는다. 모달이 아니라 이 화면 안의 겹이라 뒤 화면에 흐림을 걸 수 있다. */
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  /**
   * 흐림 위에 한 겹 더 까는 어두운 막.
   *
   * 흐림만으로는 부족하다. 안드로이드의 `BlurView`는 영상 표면을 흐리게 하지 못하고
   * (`PinDetailMedia` 주석 참고), 모달 안에서는 뒤 화면을 아예 못 잡는 경우도 있다.
   * 그래서 이 막이 흐림 없이도 뒤가 거의 보이지 않을 만큼 진해야 한다.
   */
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,26,26,.5)' },
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
  /** 시트에서 가장 큰 글자. 무엇을 하는 자리인지 한눈에 읽혀야 한다. */
  sheetTitle: { ...type.h3, alignSelf: 'flex-start', color: colors.dark },
  /** 제목에 딸린 주의 문구. 돈이 걸린 안내라 작게 흘리지 않는다. */
  sheetCaption: {
    ...type.small,
    alignSelf: 'flex-start',
    color: colors.gray400,
    marginTop: spacing.x1,
  },

  /** 비율 처리는 IllustrationVideo의 `contentFit`이 맡으므로 크기만 준다. */
  coinVideo: { width: 200, height: 200, marginTop: spacing.x6 },
  payError: { ...type.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.x3 },
  payButton: { alignSelf: 'stretch' },
  payButtonBusy: { opacity: 0.6 },
  payMessage: {
    ...type.body,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.dark,
    marginTop: spacing.x4,
    marginBottom: spacing.x6,
  },
  /**
   * 결제 시트의 코인 영상과 같은 크기·여백.
   *
   * 두 시트는 같은 자리에서 같은 높이로 올라와야 한다. 그래서 아래 여백을 여기서 주지 않고
   * 결제 시트와 똑같이 `payMessage`의 위 여백이 맡는다. 그림 크기·문구 줄 수까지 맞춰 두면
   * 두 시트의 높이가 정확히 같아진다.
   */
  chatIllustration: { width: 200, height: 200, alignSelf: 'center', marginTop: spacing.x6 },
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
