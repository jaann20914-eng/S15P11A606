import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 게시글 작성 화면 전용 스타일.
 * 화면 조각(헤더 · 세그먼트 · 촬영 · 입력 필드 · 등록 로딩)이 모두 여기서 가져다 쓴다.
 */
export const pinCreateStyles = StyleSheet.create({
  /* 화면 골격 */
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.x5 },

  /* 헤더 */
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
  headerTitle: { ...type.title, color: colors.dark },

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
  camera: {
    height: 248,
    marginTop: spacing.x5,
    position: 'relative',
    overflow: 'hidden',
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
  /** 촬영 버튼 아래 안내 문구. */
  captureHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,.75)',
  },
  timer: {
    position: 'absolute',
    right: spacing.x2,
    top: spacing.x2,
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
  recording: { borderRadius: 8, backgroundColor: '#FF2633' },
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
  tag: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x1,
    paddingHorizontal: spacing.x3,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  tagText: { ...type.caption, color: '#81942E' },
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
  placeInput: {
    height: 52,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    ...type.body,
    color: colors.dark,
  },
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
   * 검색 결과 목록.
   *
   * 결과가 많아도 화면을 밀지 않도록 최대 높이를 두고 안에서 스크롤한다.
   */
  placeList: {
    marginTop: spacing.x2,
    maxHeight: 200,
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
  placeName: { ...type.label, color: colors.dark },
  placeAddress: { ...type.caption, color: colors.gray400, marginTop: 2 },
  placeEmpty: { ...type.caption, color: colors.gray400, padding: spacing.x4 },

  /* 상세 위치 */
  detailInput: {
    height: 52,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    ...type.body,
    color: colors.dark,
  },

  /* 등록 버튼 */
  submit: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.x8,
    borderRadius: radius.lg,
    backgroundColor: colors.lime,
  },
  submitText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },

  /* 등록 로딩 */
  publishing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FBFCF8',
  },
  ambient: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.42 },
  ambientWarm: { right: -70, top: -30, backgroundColor: '#FFF0DA' },
  ambientBlue: { left: -90, bottom: 40, backgroundColor: '#E8F7FC' },
  loaderWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  loaderTrack: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 10,
    borderColor: '#E9F6C8',
    borderTopColor: '#A7EF31',
    borderRightColor: '#C4E600',
  },
  loaderMask: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#A7EF31',
    top: -3,
    left: 84,
  },
  loaderCenter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  publishingText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    color: colors.gray600,
  },
});
