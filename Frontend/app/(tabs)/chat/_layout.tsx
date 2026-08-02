import { Stack } from 'expo-router';

/**
 * 채팅 탭.
 *
 * 소켓 연결은 여기서 열지 않는다. 로그인해 있는 동안 루트에서 하나만 열어 둔다
 * (`useChatSocketSession`) — 다른 탭에 있을 때도 새 메시지와 채팅 요청을 받아야 하기
 * 때문이다. 이 탭의 화면들은 구독만 걸었다 푼다.
 */
export default function ChatLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
