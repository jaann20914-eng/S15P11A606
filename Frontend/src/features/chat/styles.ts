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
const ROW_MIN_HEIGHT = 124;

/**
 * 수락 · 거절 버튼 높이.
 *
 * 시각과 한 줄을 나눠 쓰므로 그 줄의 높이도 이 값으로 잡아 둔다. 버튼이 없는 줄까지 같은 높이를
 * 두면 대기 중인 줄만 높아지는 일이 없다.
 */
const DECISION_HEIGHT = 36;

/**
 * 글 묶음을 링 쪽으로 내리는 양.
 *
 * 두 중심을 정확히 맞추려면 12를 내려야 하는데(링 절반 24 − 글줄 절반 12) 눈으로는 그만큼이
 * 처져 보인다 — 아래에 글이 두 줄 더 있어 묶음의 무게가 아래쪽에 있기 때문이다. 그래서 조금 덜
 * 내려 첫 줄이 링 가운데보다 살짝 위에 놓이게 둔다.
 */
const AVATAR_TITLE_OFFSET = 7;

export const chatListStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1, paddingHorizontal: layout.gutter },

  /* 탭 */
  tabs: { height: 52, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  tabText: { ...type.body, color: colors.gray400, paddingBottom: spacing.x3 },
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
  /**
   * 시각 · 글을 한 덩어리로 묶는다.
   *
   * 줄 안에서는 이 덩어리가 가운데에 놓이고, 덩어리 안에서는 시각이 위로 붙는다. 그래야 시각이
   * 장소 이름과 한 선에 놓인다 — 줄 자체에 맡기면 시각은 주소까지 포함한 높이의 가운데로 내려간다.
   */
  postBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3 },
  timePill: {
    width: 68,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    /*
      알약의 윗면을 장소 이름 줄의 윗면에 맞춘다.

      묶음 안에서 둘 다 위로 붙어 있으니 따로 내리거나 올리지 않는다. 예전에 반 칸씩 손대던
      값들은 이름 · 주소 간격이 좁아 눈대중으로 맞추던 것이라, 지금 구조에서는 어긋남만 만든다.
    */
    marginTop: 0,
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
      아래 여백을 위보다 좁게 둔다.

      위는 앞 줄과 떼어 놓는 자리라 그대로 두고, 아래는 시각 바로 다음이라 좁혀도 답답하지 않다.
      세 층이 쌓인 줄이라 여백까지 넉넉하면 목록이 길어 보인다.
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
   * 첫 줄(장소 · 닉네임)이 링 가운데에 놓이도록 `AVATAR_TITLE_OFFSET`만큼 내린다. 위로 딱 붙여
   * 두면 링과 제목이 어긋나 보인다.
   *
   * 내려간 만큼 줄이 높아지므로, 그만큼은 제목 · 메시지 사이 간격에서 덜어 왔다.
   */
  chatRowCopy: { flex: 1, marginTop: AVATAR_TITLE_OFFSET, paddingRight: TRUNCATION_INSET },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  rowTitle: { ...type.body, flexShrink: 1, color: colors.dark, fontWeight: '600' },
  /**
   * 끝난 대화의 제목 · 시각.
   *
   * 진한 검정 대신 회색으로 눌러 살아 있는 대화와 한눈에 갈리게 한다. 처음에는 주소와
   * 구분하려고 중간 톤(#6D6D6D)을 썼는데 진한 제목과의 차이가 눈에 띄지 않았다 — 제목은
   * 굵기(600)가 있어 주소와 같은 색이어도 헷갈리지 않는다.
   */
  rowTitleClosed: { color: colors.gray400 },
  /**
   * 장소 이름 아래의 주소.
   *
   * 이름에 딱 붙여 두면 세 줄이 한 덩어리로 뭉쳐 보인다. 한 칸 떼어 이름을 먼저 읽히게 한다.
   * 글 묶음(60 남짓)이 줄 최소 높이보다 낮아, 이만큼 벌려도 줄은 높아지지 않는다.
   */
  address: { ...type.caption, color: colors.gray400, marginTop: spacing.x2 },
  /** 주소 끝의 괄호(법정동). 도로명에 딸린 값이라 붙여 두고 같은 크기로 쓴다. */
  addressRegion: { ...type.caption, color: colors.gray400 },
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
    // 제목과 한 묶음이라 좁혀도 읽기에 지장이 없다. 글 묶음이 내려간 만큼을 여기서 덜어 온다.
    marginTop: spacing.x1,
  },
  /**
   * 메시지가 없을 때 대신 놓는 안내. 실제 대화가 아니므로 한 단계 연하게 둔다.
   *
   * 이 문구는 늘 한 줄이라 두 줄 자리를 잡아 두지 않는다. 빈 줄을 남기면 아래 시각 · 버튼이
   * 글에서 그만큼 떨어져, 아래 선 쪽으로 치우쳐 보인다. 줄 높이는 `ROW_MIN_HEIGHT`가 지킨다.
   */
  messagePlaceholder: { minHeight: type.caption.lineHeight, color: colors.gray400 },
  /**
   * 마지막 메시지 시각.
   *
   * 위 메시지 쪽에 가깝게 둔다. 시각은 그 대화에 딸린 값이라 선 쪽으로 내려가 붙어 있으면 다음
   * 줄의 것처럼 읽힌다. 선까지의 간격은 `chatRow`의 아래 여백이 맡는다.
   */
  time: { ...type.caption, color: colors.gray400 },
  /**
   * 시각과 수락 · 거절이 함께 놓이는 마지막 줄.
   *
   * 버튼을 줄 오른쪽에 세로로 두면 링 · 글 · 버튼 세 덩어리가 되어 복잡해진다. 시각 옆은 비어
   * 있는 자리라 버튼을 두기에 알맞다.
   *
   * 버튼이 없는 줄도 같은 높이를 잡아 둔다 — 그러지 않으면 대기 중인 줄만 높아진다.
   */
  timeLine: {
    minHeight: DECISION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    /*
      위 글에 바로 이어 붙인다.

      줄 높이를 낮게 두는 편이 낫다 — 여백이 넉넉하면 목록이 늘어지고 한 화면에 담기는 줄이
      줄어든다. 이 줄은 바로 위 메시지에 딸린 것(그 대화의 시각, 그 요청에 답하는 버튼)이라
      붙어 있어도 읽기에 어색하지 않다.
    */
    marginTop: 0,
  },
  /**
   * 메시지가 없는 줄의 마지막 줄 간격.
   *
   * 두 줄 자리를 잡아 두지 않은 만큼(한 줄) 남은 자리를 위아래로 나눠 갖는다. 그래야 시각 ·
   * 버튼이 안내 문구와 아래 선의 가운데에 놓인다. 아래쪽은 `ROW_MIN_HEIGHT`가 남긴 여백이 맡는다.
   */
  timeLineCentered: { marginTop: 9 },

  /* 상태 표시 */
  statusText: { ...type.caption, fontWeight: '600' },
  pending: { color: '#FF7580' },
  active: { color: colors.success },
  ended: { color: colors.gray400 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },

  /**
   * 대기 중인 요청에 붙는 수락 · 거절.
   *
   * 줄 오른쪽 끝에 고정한다. 시각 옆에 붙여 두면 첫 메시지가 도착해 시각이 생기는 순간 버튼이
   * 옆으로 밀린다 — 같은 목록에서 줄마다 버튼 위치가 다르면 누르려던 자리가 어긋난다.
   */
  decisions: { marginLeft: 'auto', flexDirection: 'row', gap: spacing.x2 },
  decision: {
    width: 72,
    height: DECISION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    // 많이 둥글리면 글자보다 모양이 먼저 보인다. 살짝만 깎는다.
    borderRadius: radius.sm,
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
  /** 이미 떠난 글의 버튼. 지우지 않고 잠긴 모양으로 남겨 "처리됐다"를 알린다. */
  leaveButtonDone: { backgroundColor: colors.gray100 },
  leaveTextDone: { color: colors.gray400 },
});
