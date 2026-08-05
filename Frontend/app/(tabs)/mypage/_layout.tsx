import { Stack } from 'expo-router';

export default function MypageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/*
        오늘 핀 목록은 밀려 들어오지 않는다.

        글을 올리고 나면 이 목록을 스택에 깔고 그 위에 상세를 여는데, 목록까지 밀려 들어오면
        사용자는 전환을 세 번 본다(마이페이지 입구 → 목록 → 상세). 이 한 장을 즉시 바꾸면
        상세가 올라오는 전환 하나만 남는다(2026-08-05).

        메뉴에서 직접 들어올 때도 즉시 바뀐다. 목록 화면이라 밀려 들어오는 맛이 필요하지 않고,
        오히려 빠르게 열린다.
      */}
      <Stack.Screen name="activity" options={{ animation: 'none' }} />
      <Stack.Screen name="credits" />
      <Stack.Screen name="edit-nickname" />
    </Stack>
  );
}
