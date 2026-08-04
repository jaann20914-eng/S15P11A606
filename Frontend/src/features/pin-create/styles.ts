import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 게시글 작성 화면 전용 스타일.
 * 화면 조각(헤더 · 세그먼트 · 촬영 · 입력 필드 · 등록 로딩)이 모두 여기서 가져다 쓴다.
 */
/** 사라짐 구간이 바 위로 걸치는 깊이. 이만큼 아래로 내려 겹친다. */
export const ACTION_FADE_DROP = 16;

export const pinCreateStyles = StyleSheet.create({
  /* 화면 골격 */
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  form: { flex: 1 },
  /**
   * 스크롤 밖에 고정한 카메라 자리.
   *
   * 좌우 여백만 준다. 위 여백은 `camera`가 갖고 있고, 아래는 스크롤 내용의 위 여백이 맡는다.
   * 자리를 고정하는 이유는 화면 쪽 주석에 적어 두었다.
   */
  captureArea: { paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.x5 },
  /**
   * 늘 보이는 등록 버튼 자리.
   *
   * 스크롤 내용 **위에 겹쳐** 놓고, 가려지는 만큼은 아래 여백으로 돌려준다(화면이 이 바
   * 높이를 재서 넣는다).
   *
   * 바탕은 불투명한 흰색이다. 뒤가 비치게 두면 입력칸 글씨와 버튼이 겹쳐 어수선하다.
   * 경계선 대신 위에 짧은 그라데이션(`actionFade`)을 얹어 내용이 사라지며 들어가게 한다.
   *
   * **탭바 높이를 더하지 않는다.** 이 화면은 탭 네비게이터 안에 있어 화면 영역이 이미 탭바
   * 위에서 끝난다.
   */
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.x4,
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

  /* 헤더는 공용 컴포넌트(`ScreenHeader`)가 그린다. 이 화면이 그 모양의 기준이었다. */

  /* 혼잡도 세그먼트 */
  segment: {
    height: 52,
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.hero,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.card },
  segmentText: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.gray600 },
  segmentTextActive: { color: colors.dark, fontWeight: '600' },

  /* 촬영 */
  /**
   * 카메라 자리.
   *
   * **잘라내지 않는다.** 카메라는 뷰 계층 밖의 서피스에 그려져서, 부모가 둥근 모서리로 잘라내면
   * 스크롤로 자리가 바뀔 때마다 한 프레임이 비어 깜빡인다. 그래서 미리보기는 모서리가 각지게
   * 남는다 — 깜빡임과 맞바꾼 것이다. 촬영이 끝난 뒤의 재생(`CapturePreview`)은 일반 뷰라
   * 그쪽만 둥글게 두어도 된다.
   */
  camera: {
    height: 248,
    marginTop: spacing.x5,
    position: 'relative',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  /** 카메라 미리보기와 촬영 결과 재생이 같은 영역을 채운다. */
  cameraView: { width: '100%', height: '100%' },
  /** 권한이 없거나 준비 중일 때 카메라 자리에 대신 놓는 안내. */
  cameraBlocked: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    paddingHorizontal: spacing.x6,
    backgroundColor: colors.gray100,
  },
  cameraBlockedText: { ...type.caption, color: colors.gray600, textAlign: 'center' },
  cameraRetry: {
    height: 36,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  cameraRetryText: { ...type.caption, color: colors.white, fontWeight: '600' },
  /** 타이머 왼쪽의 촬영 안내 문구. */
  captureHint: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,.75)',
  },
  captureMeta: {
    position: 'absolute',
    right: spacing.x2,
    top: spacing.x2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
  },
  timer: {
    paddingHorizontal: spacing.x2,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,.58)',
  },
  timerText: { fontSize: 10, lineHeight: 14, color: colors.white },
  recordOuter: {
    position: 'absolute',
    bottom: spacing.x3,
    left: '50%',
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,.15)',
  },
  recordInner: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white },
  /**
   * 녹화 중 표시. 둥근 네모로 바뀐다.
   *
   * 크기를 함께 줄여야 한다. 같은 38로 두면 네모의 대각선(53)이 테두리 안쪽 지름(44)보다 길어
   * 모서리가 바깥 원을 뚫고 나온다. 28이면 대각선이 40이라 안쪽에 여유 있게 들어간다.
   */
  recording: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FF2633' },
  recordDone: { backgroundColor: colors.white },
  /** 재촬영 · 전후면 전환처럼 촬영 화면 우측 상단에 얹는 원형 버튼. */
  cameraAction: {
    position: 'absolute',
    right: spacing.x2,
    top: spacing.x8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,.45)',
  },

  /* 내용 입력 */
  memo: {
    height: 100,
    marginTop: spacing.x5,
    padding: spacing.x4,
    textAlignVertical: 'top',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    ...type.small,
    color: colors.dark,
  },

  /* 공통 라벨 */
  label: {
    ...type.label,
    color: colors.dark,
    fontWeight: '600',
    marginTop: spacing.x5,
    marginBottom: spacing.x2,
  },
  subLabel: { ...type.caption, color: colors.gray400 },

  /* 태그 */
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  /** 글자(14)와 삭제 아이콘(18)이 들어가려면 30으로는 좁다. */
  tag: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x1,
    paddingHorizontal: spacing.x3,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  tagText: { ...type.small, color: '#81942E' },
  tagInputRow: { height: 44, flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x2 },
  tagInput: {
    flex: 1,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    ...type.small,
    color: colors.dark,
  },
  addButton: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray200,
  },
  disabled: { opacity: 0.45 },
  addText: { ...type.label, color: colors.gray600 },

  /* 내 위치 */
  /**
   * 아직 고르지 않은 줄의 글자.
   *
   * 입력칸의 안내문과 같은 색으로 둔다 — 눌러서 채워야 하는 자리라는 점이 같다.
   */
  placePlaceholder: { ...type.body, color: colors.gray400 },
  /** 선택 완료 상태. 입력창이 아니라 고른 장소를 보여주는 줄이 된다. */
  placeSelected: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  placeSelectedText: { ...type.body, color: colors.dark },
  /**
   * 장소 후보 목록.
   *
   * 높이를 묶고 안에서 스크롤한다. 후보가 많을 때 목록이 폼을 아래로 밀어내면 혼잡도·메모 같은
   * 다음 칸이 화면에서 사라져, 무엇을 더 채워야 하는지 보이지 않는다.
   *
   * 높이는 **줄의 정수배가 아니게** 둔다(줄 높이 64에 224 = 3.5줄). 마지막 줄이 반쯤 잘려
   * 보이면 아래에 더 있다는 것이 그대로 읽힌다 — 딱 맞게 두면 목록이 거기서 끝난 것처럼 보인다.
   */
  placeList: {
    marginTop: spacing.x2,
    maxHeight: 224,
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  placeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  /** 줄 안에서 이름 · 주소 묶음. 오른쪽 거리 표시에 자리를 내주고 남은 폭을 쓴다. */
  placeRowCopy: { flex: 1, paddingRight: spacing.x3 },
  placeName: { ...type.label, color: colors.dark },
  placeAddress: { ...type.caption, color: colors.gray400, marginTop: 2 },
  /** 수정 화면의 장소 후보 거리. 검색 결과의 거리 표시와 같은 자리다. */
  placeDistance: { ...type.caption, color: colors.gray400 },
  /** 수정 진입 시 기존 값을 불러오는 동안·실패했을 때. */
  formState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.x3, padding: spacing.x6 },
  formStateText: { ...type.small, textAlign: 'center', color: colors.gray600 },
  placeEmpty: { ...type.caption, color: colors.gray400, padding: spacing.x4 },
  /** 촬영 자리에서 멀어 선택이 취소됐을 때의 안내. 입력칸 바로 아래에 붙는다. */
  placeNotice: { ...type.caption, color: colors.danger, marginTop: spacing.x2 },
  /** 검색 중·실패 상태를 목록 자리에 대신 놓는다. */
  placeStatus: { alignItems: 'center', justifyContent: 'center', gap: spacing.x2, padding: spacing.x4 },
  placeRetry: {
    height: 32,
    paddingHorizontal: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  placeRetryText: { ...type.caption, color: colors.gray600, fontWeight: '600' },

  /* 상세 위치 */
  detailInput: {
    height: 52,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    ...type.body,
    color: colors.dark,
  },

  /* 등록 버튼. 위 여백은 감싸는 고정 영역(`actionBar`)이 준다. */
  submit: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.lime,
  },
  submitText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },

  /* 등록 로딩 */
  /** 배경 영상이 화면을 채운다. 바탕색은 영상이 뜨기 전 한 프레임을 위한 것이다. */
  publishing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FBFCF8',
  },
  loader: { alignItems: 'center', justifyContent: 'center' },
  /** 도는 판. 길이가 다른 링 그림들이 이 안에 겹쳐 있다. */
  loaderRing: { position: 'absolute' },
  loaderRingFrame: { position: 'absolute', resizeMode: 'contain' },
  /**
   * 링 안쪽의 흰 원.
   *
   * 배경 영상 위에 글자를 그대로 올리면 구체가 지나갈 때 읽기 어려워진다. 링 안쪽을 흰색으로
   * 채워 글자가 놓일 자리를 만든다.
   */
  loaderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x6,
    backgroundColor: colors.white,
  },
  /** 본문 앞머리. "AI를 이용하여"처럼 문장을 여는 줄이다. */
  publishingLead: {
    ...type.small,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.gray400,
    marginBottom: spacing.x2,
  },
  publishingText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    color: colors.gray600,
  },
  /** 알아 둬야 할 것. 본문과 떨어뜨려 한 단계 작게 쓴다. */
  publishingNote: {
    ...type.small,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.gray400,
    marginTop: spacing.x4,
  },
  /** 업로드 퍼센트. 안내 문구 아래에 크게 놓는다. */
  publishingProgress: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.dark,
    marginTop: spacing.x2,
  },
  publishingCancel: {
    marginTop: spacing.x6,
    height: 44,
    paddingHorizontal: spacing.x6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  publishingCancelText: { ...type.label, color: colors.gray600, fontWeight: '600' },
});
