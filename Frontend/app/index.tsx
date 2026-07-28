// 앱 최초 진입점. 인증 상태 분기가 들어오기 전까지는 로그인으로 보낸다.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
