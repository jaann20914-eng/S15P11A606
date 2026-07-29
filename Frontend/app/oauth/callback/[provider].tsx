import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * App Link 복귀 주소(`/oauth/callback/kakao|naver`)를 받아 두는 자리.
 *
 * 인가 코드 처리는 이 화면이 하지 않는다. `useOAuthLogin`이 열어 둔
 * `openAuthSessionAsync`가 복귀 URL을 먼저 가로채 브라우저를 닫고 다음 화면으로 보낸다.
 *
 * 그래도 라우트를 두는 이유는 expo-router가 이 경로를 매칭하려 할 때
 * "Unmatched Route" 화면이 잠깐 스치는 것을 막기 위해서다. 여기서 직접 이동하면
 * 훅의 이동과 경합하므로 아무것도 하지 않고 스피너만 보여준다.
 */
export default function OAuthCallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.gray600} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
