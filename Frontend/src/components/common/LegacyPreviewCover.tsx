import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SUPPORTS_FILTER_BLUR } from '@/utils/blurSupport';

/**
 * `filter` 흐림이 듣지 않는 기기(안드로이드 11 이하)에서 **영상 위에 덮는 겹**.
 *
 * 왜 흐림이 아니라 덮개인가. 그 버전에는 영상 표면을 흐리게 할 수단이 아예 없다.
 * `RenderEffect`는 API 31부터고(`blurSupport` 참고), `BlurView`는 상위 뷰를 비트맵으로
 * 다시 그려서 흐리게 하는 방식이라 **영상 표면이 그 캔버스에 아무것도 그리지 않아** 막만
 * 남는다(`PinDetailMedia`의 `PREVIEW_BLUR_RADIUS` 설명에 남아 있는 실패 기록이다).
 * 그러니 "흐리게 하려다 실패해서 다 보이는" 쪽보다 **확실히 가리는** 쪽을 고른다 —
 * 결제 전 현장이 드러나는 것은 기능 문제가 아니라 유료 정책이 뚫리는 일이다.
 *
 * 그래도 판판한 회색으로 덮지는 않는다. `BlurView`를 한 겹 올려 두면 흐림이 되는 기기에서는
 * 자연스러운 서리 느낌이 나고, 되지 않는 기기에서도 아래 막이 이미 가리고 있어 안전하다.
 * **아래 막만으로 가려지는 값이어야 한다** — 흐림은 보태기지 기대는 수단이 아니다.
 *
 * `filter`가 듣는 기기에서는 **아무것도 그리지 않는다**. 그쪽은 기존 흐림이 이미 맡고 있고,
 * 이 겹이 덧대지면 멀쩡한 화면이 괜히 탁해진다.
 */

/**
 * 덮개의 불투명도.
 *
 * 자리 배치(사람이 있는 자리, 좌석 덩어리)는 어렴풋이 읽히고 얼굴·글자·혼잡도는 셀 수 없는
 * 정도로 잡았다. 완전히 가리면 무엇을 사는 것인지 알 수 없어 구매로 이어지지 않는다.
 */
const COVER_OPACITY = 0.92;

/** 흐림 세기. 되는 기기에서 서리 질감만 얹는 정도다. 가리는 일은 아래 막이 한다. */
const COVER_BLUR_INTENSITY = 40;

export function LegacyPreviewCover() {
  if (SUPPORTS_FILTER_BLUR) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={s.scrim} />
      <BlurView intensity={COVER_BLUR_INTENSITY} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: `rgba(233,232,232,${COVER_OPACITY})` },
});
