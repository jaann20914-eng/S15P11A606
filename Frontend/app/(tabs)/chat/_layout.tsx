import { useCallback } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { retainSocket } from '@/api/chat/socket/client';

/**
 * 채팅 탭.
 *
 * 이 탭에 있는 동안만 WebSocket을 열어 둔다(연결 명세의 정책). 탭을 벗어나면 끊고, 돌아오면
 * 다시 연결한다. 탭 안에서 목록 → 채팅방으로 옮기는 것은 같은 연결을 이어 쓴다.
 *
 * 화면이 내려가는 것(`unmount`)이 아니라 **초점**을 기준으로 삼는다. 탭 레이아웃은 다른 탭에
 * 가 있어도 그대로 살아 있어서, 마운트 기준으로 잡으면 앱을 켠 뒤로 계속 연결된 채가 된다.
 */
export default function ChatLayout() {
  useFocusEffect(useCallback(() => retainSocket(), []));

  return <Stack screenOptions={{ headerShown: false }} />;
}
