import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 채팅 목록 화면 전용 스타일.
 *
 * 요청한 대화 · 요청받은 대화(게시글 → 방 목록)가 한 화면을 나눠 쓴다.
 */
/**
 * 줄임표가 끝나는 자리를 화면 오른쪽에서 이만큼 안으로 들인다.
 *
 * 목록마다 오른쪽에 붙는 것이 다르다 — 게시글 줄에는 화살표가 있고 채팅방 줄에는 없다. 글이
 * 저마다의 끝까지 차면 줄임표가 줄마다 다른 자리에서 끝나 목록이 어수선해 보인다. 같은 값을
 * 두어 어느 줄에서 잘려도 오른쪽 여백이 같아 보이게 한다.
 */
const TRUNCATION_INSET = 8;

/**
 * 상대의 뷰 각도 링 지름.
 *
 * 줄에서 가장 먼저 눈에 들어오는 것이라 36으로는 작았다. 글 묶음(제목 · 메시지 두 줄 · 시각)이
 * 90 남짓이므로 그보다 작게 두어야 줄 높이를 늘리지 않는다.
 */
export const AVATAR_SIZE = 48;

/**
 * 목록 한 줄의 최소 높이.
 *
 * 게시글 줄과 채팅방 줄이 같은 값을 쓴다. 탭을 옮길 때 줄 높이가 달라지면 같은 목록이 아닌 것처럼
 * 보인다. 채팅방 줄(제목 · 메시지 두 줄 · 시각)이 자연히 갖는 높이에 맞췄다.
 */
const ROW_MIN_HEIGHT = 104;

/**
 * 글 묶음을 링 쪽으로 내리는 양.
 *
 * 첫 줄 중심을 링 가운데(지름의 절반)에 맞추면 눈으로는 처져 보인다 — 아래에 글이 두 줄 더
 * 있어 묶음의 무게가 아래쪽에 있기 때문이다. 그래서 절반만 내린다.
 */
const AVATAR_TITLE_OFFSET = Math.round((AVATAR_SIZE / 2 - type.label.lineHeight / 2) / 2);

export const chatListStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1, paddingHorizontal: layout.gutter },

  /* 탭 */
  tabs: { height: 52, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  tabText: { ...type.label, color: colors.gray400, paddingBottom: spacing.x3 },
  tabTextActive: { color: colors.dark, fontWeight: '600' },
  tabLine: { height: 3, width: '100%', backgroundColor: 'transparent' },
  tabLineActive: { backgroundColor: colors.dark },

  /* 검색 — 서버에 다시 묻지 않고 받아 온 목록에서 걸러낸다. */
  search: {
    height: 48,
    marginVertical: spacing.x3,
    paddingHorizontal: spacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  input: { ...type.body, flex: 1, color: colors.dark },

  /* 목록 */
  list: { paddingBottom: spacing.x6 },
  /** 불러오는 중 · 실패 · 빈 목록이 같은 자리를 쓴다. */
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: spacing.x3 },
  stateText: { ...type.small, textAlign: 'center', color: colors.gray400 },
  retry: {
    height: 36,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  retryText: { ...type.caption, color: colors.gray600, fontWeight: '600' },

  /* 게시글 줄(요청받은 대화 첫 화면) */
  postRow: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  timePill: {
    width: 68,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  timePillText: { ...type.label, color: colors.gray600 },

  /* 채팅방 줄 */
  chatRow: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    /*
      위아래 여백을 따로 둔다.

      위는 앞 줄과 떨어뜨리는 자리라 그대로 두고, 아래는 시각 바로 다음이라 좁혀도 답답하지
      않다. 세 층이 쌓인 줄이어서 여백까지 넉넉하면 목록이 늘어져 보인다.
    */
    paddingTop: spacing.x2,
    paddingBottom: spacing.x1,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  rowCopy: { flex: 1, paddingRight: TRUNCATION_INSET },
  /**
   * 채팅방 줄의 글 묶음.
   *
   * 위로 딱 붙여 두면 링과 제목이 어긋나 보여 조금 내린다.
   *
   * 계산으로는 8을 내려야 첫 줄 중심(10)이 링 가운데(18)와 맞는다. 그런데 눈으로는 그만큼이
   * 처져 보인다 — 아래에 글이 두 줄 더 있어 묶음 전체의 무게가 아래쪽에 있기 때문이다.
   * 그래서 절반만 내려 첫 줄이 링 가운데보다 조금 위에 놓이게 둔다.
   *
   * 아래 여백은 `chatRow`의 것을 그대로 두어, 내려간 만큼 줄만 높아진다.
   */
  chatRowCopy: { flex: 1, marginTop: AVATAR_TITLE_OFFSET, paddingRight: TRUNCATION_INSET },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  rowTitle: { ...type.label, flexShrink: 1, color: colors.dark, fontWeight: '600' },
  address: { ...type.caption, color: colors.gray400, marginTop: 2 },
  /**
   * 마지막 메시지. 두 줄까지 보여주고 넘치면 줄임표로 끝낸다.
   *
   * 한 줄로 자르면 무슨 이야기인지 짐작하기 어렵고, 세 줄이 되면 줄마다 높이가 달라져 목록이
   * 들쭉날쭉해진다.
   */
  message: {
    ...type.caption,
    // 두 줄만큼 늘 자리를 잡아 둔다. 한 줄짜리 메시지에서도 줄 높이가 같아진다.
    minHeight: type.caption.lineHeight * 2,
    color: colors.gray600,
    marginTop: spacing.x2,
  },
  /** 메시지가 없을 때 대신 놓는 안내. 실제 대화가 아니므로 한 단계 연하게 둔다. */
  messagePlaceholder: { color: colors.gray400 },
  /**
   * 마지막 메시지 시각.
   *
   * 메시지와는 한 칸 떼고, 아래 선에는 가깝게 둔다. 시각은 그 위 대화에 딸린 값이라 선 쪽으로
   * 내려가 붙어 있으면 다음 줄의 것처럼 읽힌다. 선까지의 간격은 `chatRow`의 아래 여백이 맡는다.
   */
  time: { ...type.caption, color: colors.gray400, marginTop: spacing.x1 },

  /* 상태 표시 */
  statusText: { ...type.caption, fontWeight: '600' },
  pending: { color: '#FF7580' },
  active: { color: colors.success },
  ended: { color: colors.gray400 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },

  /**
   * 대기 중인 요청에 붙는 수락 · 거절.
   *
   * 글 아래가 아니라 오른쪽에 세운다. 아래에 붙이면 대기 중인 줄만 높아져 목록이 들쭉날쭉해진다.
   */
  decisions: { justifyContent: 'center', gap: spacing.x2 },
  decision: {
    width: 60,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  accept: { backgroundColor: colors.lime },
  acceptText: { ...type.caption, color: colors.dark, fontWeight: '600' },
  reject: { backgroundColor: colors.gray100 },
  rejectText: { ...type.caption, color: colors.gray600, fontWeight: '600' },
  busy: { opacity: 0.6 },

  /* 게시글을 고른 화면 아래의 종료 버튼 */
  leaveArea: { paddingTop: spacing.x3, paddingBottom: spacing.x2 },
  leaveHint: { ...type.caption, color: colors.gray400, marginBottom: spacing.x2 },
  leaveButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  leaveButtonBusy: { opacity: 0.6 },
  leaveText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#D9ED76' },
});
