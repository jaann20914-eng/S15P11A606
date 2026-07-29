import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { pinCreateStyles as s } from '../styles';

/** 한 바퀴 도는 데 걸리는 시간. */
const SPIN_DURATION_MS = 1050;

/**
 * 등록 진행 화면.
 *
 * AI 블러 처리가 끝날 때까지 이 화면에 머문다. MVP에서는 취소·뒤로 가기를 열지 않고,
 * 화면을 벗어나면 업로드가 끊길 수 있다는 사실만 문구로 알린다.
 */
export function PublishingOverlay() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.publishing}>
      <View style={[s.ambient, s.ambientWarm]} />
      <View style={[s.ambient, s.ambientBlue]} />

      <View style={s.loaderWrap}>
        <Animated.View style={[s.loaderTrack, { transform: [{ rotate }] }]}>
          <View style={s.loaderMask} />
        </Animated.View>
        <View style={s.loaderCenter}>
          <Text style={s.publishingText}>
            AI를 이용하여{'\n'}블러 처리중입니다{'\n'}앱을 종료하는 경우{'\n'}업로드가 중단될 수 있습니다
          </Text>
        </View>
      </View>
    </View>
  );
}
