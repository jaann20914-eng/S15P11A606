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
 *
 * 다른 탭에서도 실시간으로 받으려면 이 자리를 로그인 시점으로 옮기면 된다. 다만 앱이
 * 백그라운드로 가면 어차피 끊기므로, 알림은 푸시(FCM)와 함께 정하는 것이 맞다.
 */
export default function ChatLayout() {
  useFocusEffect(useCallback(() => retainSocket(), []));

  return <Stack screenOptions={{ headerShown: false }} />;
}
