/**
 * 디자인 토큰 단일 소스.
 *
 * - `color` / `space` / `shape` / `typography`: 공통DESIGN v1(§4~§6) 스펙 토큰. 신규 화면은 이 토큰을 우선 사용한다.
 * - `colors` / `spacing` / `radius` / `layout` / `type`: 현재 목업 화면이 사용 중인 토큰.
 *   스펙 토큰과 값이 다른 항목(예: 카드 radius, Display 크기)은 각 정의에 근거를 주석으로 남겼다.
 */

/* ------------------------------------------------------------------ *
 * 원시 팔레트 (hex는 여기에만 등장한다)
 * ------------------------------------------------------------------ */

const palette = {
  lime: '#C4E600',
  limeActive: '#B8D900',
  limeSoft: '#F4FAD8',
  limeControl: '#D9ED76',
  limeText: '#8FA900',

  coral: '#FFBBBB',
  coralActive: '#FF8F97',
  coralSoft: '#FFE3E4',

  mint: '#5AC8B4',
  mintSoft: '#E6F7F3',

  dark: '#3B3838',
  white: '#FFFFFF',
  surface: '#F7F7F5',
  warmSurface: '#FAF9F5',
  gray100: '#F4F3F3',
  gray200: '#E9E8E8',
  gray400: '#9B9898',
  gray600: '#666262',

  danger: '#E5545E',
  warning: '#FFB340',
  success: '#39A96B',
  blue: '#648DF7',
  infoBlue: '#348BF2',
  sky: '#EAF4FF',

  /** 혼잡도 4단계 (공통DESIGN §4.2) */
  crowdQuiet: '#D3E965',
  crowdNotCrowded: '#EFF89D',
  crowdCrowded: '#F3C8A4',
  crowdVeryCrowded: '#E58883',

  /*
    혼잡도 4단계를 **글자로 쓸 때**의 농도.

    위 네 값은 칩·링을 채우는 파스텔이라 흰 배경에서 글자로 쓰면 읽히지 않는다. 같은 두 계열
    (라임·자몽)을 유지하면서 단계가 올라갈수록 진해지도록 옮긴 값이다.
    `crowdNotCrowdedText`는 이미 있는 `limeText`와 같은 농도라 따로 두지 않는다.
  */
  crowdQuietText: '#6E8200',
  crowdCrowdedText: '#F4767F',
  crowdVeryCrowdedText: '#D63F4A',

  /** 내 위치 마커 (공통DESIGN §4.3) */
  locationMe: '#4C9AFF',

  kakao: '#FEE500',
  naver: '#03C75A',
} as const;

/**
 * 혼잡도 4단계 색 (공통DESIGN §4.2).
 * 단계 명칭·구간과 함께 쓰는 완성된 토큰은 `@/constants/crowdLevels`에 있다.
 */
export const crowdPalette = {
  quiet: palette.crowdQuiet,
  notCrowded: palette.crowdNotCrowded,
  crowded: palette.crowdCrowded,
  veryCrowded: palette.crowdVeryCrowded,
  /** 프로필 뷰 포인트 링의 "미채움/미인증" 구간 배경 (혼잡도 값이 아니다) */
  unfilled: palette.coralSoft,
} as const;

/**
 * 혼잡도 4단계를 글자로 쓸 때의 색.
 *
 * `crowdPalette`(칩·링을 채우는 파스텔)와 짝이다. 계열은 같고 농도만 다르다 —
 * 여유 계열은 라임, 와글 계열은 자몽이며 단계가 올라갈수록 진해진다.
 */
export const crowdTextPalette = {
  quiet: palette.crowdQuietText,
  notCrowded: palette.limeText,
  crowded: palette.crowdCrowdedText,
  veryCrowded: palette.crowdVeryCrowdedText,
} as const;

/* ------------------------------------------------------------------ *
 * §4 컬러 시스템 — 의미 기반 토큰
 * ------------------------------------------------------------------ */

export const color = {
  /** 주요 CTA, 활성 탭, 로고 그린 세그먼트. 라임 위 텍스트는 항상 `color.text.onPrimary`. */
  primary: {
    base: palette.lime,
    pressed: palette.limeActive,
    soft: palette.limeSoft,
    /** 중앙 영상핀 버튼 등 보조 CTA용 옅은 라임 */
    control: palette.limeControl,
  },
  /** 실시간 영상핀, 도움 요청 카드 등 영상 관련 요소에 한정 사용 */
  secondary: {
    mint: palette.mint,
    mintSoft: palette.mintSoft,
  },
  semantic: {
    /** 주의 · 진행 대기 (게시 대기중 등) */
    warning: palette.warning,
    /**
     * 신고·삭제·종료, AI 안전 감지 종료 팝업.
     * 공통DESIGN §4.1의 `color.warning`(코럴/레드)이 의미상 이 토큰에 해당한다.
     */
    danger: palette.danger,
    dangerSurface: palette.coralSoft,
    success: palette.success,
    info: palette.blue,
    infoSurface: palette.sky,
  },
  text: {
    primary: palette.dark,
    secondary: palette.gray600,
    disabled: palette.gray400,
    /** 게시 완료 등 진입 가능한 상태 텍스트 */
    link: palette.infoBlue,
    onPrimary: palette.dark,
    onDark: palette.white,
    onLime: palette.limeText,
  },
  bg: {
    base: palette.white,
    /** 옅은 회색 보조 배경 */
    muted: palette.surface,
    warm: palette.warmSurface,
    /** 지도 로딩 전 배경 */
    map: '#E9EEE8',
  },
  surface: {
    /** 카드, 바텀시트, 리스트 행 */
    base: palette.white,
    /** 입력·아이콘 배경, 약한 구분 */
    subtle: palette.gray100,
    /** 지도 위 글래스 카드 */
    glass: 'rgba(255,255,255,0.92)',
    glassBorder: 'rgba(255,255,255,0.82)',
  },
  border: {
    hairline: palette.gray200,
    subtle: palette.gray100,
  },
  /**
   * §4.3 핀 컬러. 상단 혼잡도 필터 선택 상태에 따라 계열이 전환된다.
   * - `wagle`: '와글' 필터 → '와글'/'와글와글' 장소를 코럴/레드 계열로 표시
   * - `relaxed`: '여유' 필터 → '여유'/'유유자적' 장소를 라임 그린 계열로 표시
   * `soft`는 기본 상태 핀, `strong`은 선택/포커스 핀이다.
   */
  pin: {
    wagle: {
      soft: palette.coral,
      strong: palette.coralActive,
      label: palette.white,
    },
    relaxed: {
      soft: palette.limeControl,
      strong: palette.lime,
      label: palette.limeText,
    },
  },
  /** 내 위치 마커 전용. 핀 팔레트와 혼용하지 않는다 (§4.3). */
  location: {
    me: palette.locationMe,
    meBorder: palette.white,
    mePulse: 'rgba(76,154,255,0.24)',
  },
  /** 혼잡도 필터 토글 트랙 (홈 바텀시트 · 추천 화면 공용) */
  filter: {
    relaxedTrack: ['#D9F43C', '#B8DD00'] as const,
    wagleTrack: ['#FF9297', '#FF6F76'] as const,
    relaxedLabel: '#758900',
    wagleLabel: palette.white,
  },
  social: {
    kakao: palette.kakao,
    naver: palette.naver,
  },
} as const;

/* ------------------------------------------------------------------ *
 * §6 Spacing / Radius / Elevation
 * ------------------------------------------------------------------ */

/** 간격 토큰. 4의 배수만 사용하고 임의 값을 새로 만들지 않는다. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

/** 모서리 반경 토큰 (공통DESIGN §6). 목업 화면이 쓰는 값은 아래 `radius`를 참고. */
export const shape = {
  /** 카드 */
  card: 12,
  /** large/middle 버튼 */
  button: 10,
  /** 칩, 뱃지, small 버튼 */
  pill: 999,
} as const;

/**
 * 지도 위에 떠 있는 카드에만 사용하는 옅은 elevation.
 * 리스트 내부 카드는 그림자 없이 `color.border.hairline` 구분선으로 대체한다 (§1.5).
 */
export const elevation = {
  floating: {
    shadowColor: '#282626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  card: {
    shadowColor: palette.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;

/* ------------------------------------------------------------------ *
 * §5 타이포그래피
 * ------------------------------------------------------------------ */

/**
 * 공통DESIGN §5 스펙 스케일. 숫자(온도/크레딧/각도)는 SemiBold 이상을 사용한다.
 * 현재 목업 화면은 아래 `type` 스케일을 쓰고 있어 값이 다르다 (예: Display 24 vs 36).
 * 신규 화면은 이 스케일을 우선 적용한다.
 */
export const typography = {
  display: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.1 },
  /** 숫자 강조용 (온도 `92°`, 크레딧 `120`, 각도 `520°`) */
  numeric: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
} as const;

/* ------------------------------------------------------------------ *
 * §3 레이아웃
 * ------------------------------------------------------------------ */

export const layout = {
  referenceWidth: 390,
  referenceHeight: 844,
  /** 반응형 좌우 여백은 `useResponsivePadding()`을 사용한다. 아래 값은 그 클램프 범위와 기준값. */
  gutterSmall: 16,
  gutter: 20,
  gutterLarge: 24,
  gutterMax: 28,
  columnCount: 4,
  columnGutter: 12,
  headerHeight: 56,
  buttonHeight: 56,
  secondaryButtonHeight: 44,
  inputHeight: 56,
  searchHeight: 52,
  tabBarHeight: 72,
  minTouch: 44,
  cardPadding: 20,
  heroPadding: 24,
  sheetRadius: 24,
  modalRadius: 24,
} as const;

/* ------------------------------------------------------------------ *
 * 목업 화면이 사용 중인 토큰
 * 위 스펙 토큰과 이름이 겹치지 않게 유지하고, 화면 이관은 점진적으로 진행한다.
 * ------------------------------------------------------------------ */

export const colors = {
  lime: palette.lime,
  limeActive: palette.limeActive,
  crowded: palette.coral,
  crowdedActive: palette.coralActive,
  dark: palette.dark,
  white: palette.white,
  bg: palette.white,
  surface: palette.surface,
  warmSurface: palette.warmSurface,
  gray100: palette.gray100,
  gray200: palette.gray200,
  gray400: palette.gray400,
  gray600: palette.gray600,
  blue: palette.blue,
  /** 레거시 5단계 혼잡 색. 신규 화면은 `crowdLevels`(4단계)를 사용한다. */
  calm: '#5B8FF9',
  easy: '#82C9A0',
  normal: '#F2C94C',
  busy: '#F2994A',
  packed: '#E75D67',
  danger: palette.danger,
  warning: palette.warning,
  success: palette.success,
  sky: palette.sky,
  /**
   * 지도 위 바텀시트의 표면.
   *
   * 카드용 글래스(`color.surface.glass`, 0.92)보다 조금 투명하지만 **면적이 훨씬 넓다.**
   * 넓은 면을 옅게 두면 아래 지도의 글자·선이 그대로 배어 나와 시트 안 내용과 섞여 읽힌다.
   * 홈 시트와 장소 상세가 같은 값을 쓴다 — 두 화면이 나란히 이어지므로 농도가 다르면
   * 화면을 옮길 때 눈에 띈다. **농도를 바꾸려면 이 값 하나만 고친다.**
   */
  sheetSurface: 'rgba(255,255,255,0.88)',
  limeSoft: palette.limeSoft,
  /**
   * 와글(붐빔) 계열의 옅은 배경. `limeSoft`와 짝이다.
   *
   * 혼잡도 필터가 여유/와글 두 계열로 갈리므로(§4.3) 옅은 배경도 두 짝이 필요하다.
   * 라임 쪽만 있어 와글 쪽은 `semantic.dangerSurface`(같은 색이지만 "위험" 뜻)를 끌어다 쓰는
   * 일이 생겼다. 혼잡도 맥락에서는 이 이름을 쓴다.
   */
  coralSoft: palette.coralSoft,
  /** 중앙 영상핀 버튼 등 라임 계열 컨트롤 배경 (DESIGN_GUIDE 10.6). */
  limeControl: palette.limeControl,
  kakao: palette.kakao,
  naver: palette.naver,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, card: 20, hero: 24, pill: 999 } as const;

export const spacing = {
  x1: space.xs,
  x2: space.sm,
  x3: space.md,
  x4: space.lg,
  x5: space.xl,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
} as const;

export const type = {
  display: { fontSize: 36, lineHeight: 46, fontWeight: '700' as const, letterSpacing: -0.8 },
  h1: { fontSize: 30, lineHeight: 39, fontWeight: '700' as const, letterSpacing: -0.6 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.3 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const, letterSpacing: -0.05 },
  small: { fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0.1 },
} as const;
