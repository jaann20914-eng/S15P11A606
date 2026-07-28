// 등록 완료 화면은 폼에서 Alert으로 처리한다. 기획서 흐름의 경로만 유지하고 홈으로 보낸다.
import { Redirect } from 'expo-router';

export default function Publishing() {
  return <Redirect href="/(tabs)/home" />;
}
