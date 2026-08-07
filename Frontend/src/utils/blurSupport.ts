import { Platform } from 'react-native';

/**
 * `filter: [{ blur }]` 스타일이 이 기기에서 실제로 걸리는지.
 *
 * **안드로이드 11 이하에서는 조용히 무시된다.** 리액트 네이티브의 안드로이드 구현
 * (`BaseViewManager.setBackgroundBlurRadius` 경로)이 이렇게 갈라진다.
 *
 * ```java
 * if (FilterHelper.isOnlyColorMatrixFilters(filter)) {
 *   p.setColorFilter(...);                                  // 색 필터는 모든 버전
 * } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
 *   view.setRenderEffect(FilterHelper.parseFilters(filter)); // blur는 여기뿐
 * }
 * ```
 *
 * `blur`는 `RenderEffect`로만 구현되는데 그 클래스가 **API 31(안드로이드 12)에서 처음
 * 생겼다**(`FilterHelper.kt`에도 `@TargetApi(31)`이 붙어 있다). 그래서 11 이하에서는
 * `else if`를 건너뛰고 **예외도 경고도 없이** 아무 일도 일어나지 않는다. 화면에는 가려야 할
 * 것이 그대로 드러난다 — 결제 전 영상이 선명하게 보이는 길이라 반드시 대비가 필요하다.
 *
 * 값이 참이어도 새 아키텍처(Fabric)가 아니면 `filter` 값 자체가 뷰에 전달되지 않는다
 * (같은 파일 `setFilter`가 `UIManagerType.FABRIC`일 때만 태그를 심는다). 이 앱은
 * `newArchEnabled: true`라 정상 빌드에서는 만족하지만, 그 전제가 깨진 클라이언트에서는
 * 이 상수가 참이어도 흐려지지 않을 수 있다.
 *
 * **거짓일 때 쓰는 대체 수단은 자리마다 다르다.**
 * - 그림은 `Image`의 `blurRadius`로 진짜 흐리게 할 수 있다(네이티브 구현, 버전을 안 가린다).
 * - 영상은 흐리게 할 방법이 없다. 가려서 막는다(`LegacyPreviewCover`).
 */
export const SUPPORTS_FILTER_BLUR = Platform.OS !== 'android' || Number(Platform.Version) >= 31;
