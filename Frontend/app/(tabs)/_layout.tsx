import { CommonActions, StackActions } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import { APP_TABS, AppTabBar } from '@/components/common';
import type { AppTab } from '@/components/common';

/**
 * 탭을 벗어나면 안에 쌓인 화면을 접고 첫 화면으로 돌아가는 탭.
 *
 * 마이페이지(크레딧·닉네임 수정)와 추천(장소 상세)은 다른 탭에 다녀온 사람이 "이어 보던
 * 깊은 화면"이 아니라 그 탭의 입구를 기대한다. 홈·채팅·작성은 손대지 않는다 — 홈의 검색
 * 스택과 채팅의 연결 상태는 탭을 오가도 이어져야 한다.
 */
const RESET_ON_LEAVE = new Set<AppTab>(['mypage', 'recommend']);

/**
 * 탭 네비게이터.
 *
 * 하단 바는 React Navigation의 기본 렌더링을 쓰지 않고 `AppTabBar`를 그대로 그린다.
 * 탭 밖 화면(장소·핀 상세)도 같은 컴포넌트를 쓰므로 **모든 페이지에서 한 가지 모양**이 된다.
 * 예전에는 두 렌더러가 토큰만 공유해, 항목 간격과 라벨 배치가 미묘하게 달랐다.
 *
 * 순서·아이콘·색은 `src/components/common/AppTabBar`가 단일 소스다.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <AppTabBar
          // 바 슬롯이 이미 자리를 잡아 주므로 절대 배치를 끈다.
          floating={false}
          active={state.routes[state.index]?.name as AppTab}
          onTabPress={(tab) => {
            /*
              **얹힌 탭 겹 안에서 탭을 누르면, 겹을 전부 걷고 진짜 탭으로 간다.**

              장소 화면의 "작성하러 가기"·핀 상세의 "채팅 보내기"는 탭 안 경로를 push로 열어
              탭 그룹이 통째로 루트에 얹힌다. 그 안에서 탭을 누르면 navigate가 **복제 그룹
              안의 탭**을 새로 마운트해, 겹은 그대로 쌓인 채 어긋난 홈이 나왔다(2026-08-06
              실기기 — 파라미터 없는 태그 화면까지 나왔다).

              루트 스택에 화면이 쌓여 있으면(= 이 탭 그룹이 겹으로 얹혀 있으면) 입구까지 걷고,
              **원래 탭 그룹**의 그 탭으로 보낸다. 홈이면 홈 스택도 입구(index)로 되감는다 —
              장소·핀 상세가 그리는 탭바(AppTabBar 기본 동작)와 같은 결과다.

              **router가 아니라 dispatch로 직접 보낸다.** router 명령은 큐에 쌓였다 effect에서
              실행되는데, 대상 키 계산은 부른 시점의 상태로 한다 — 겹을 걷는 명령과 함께 쓰면
              두 번째 명령이 이미 사라진 겹의 키를 겨냥해 버려진다. 여기서 읽는 키는 전부
              걷히지 않는 원래 그룹의 것이라 순서대로 안전하다.
            */
            const rootNavigation = navigation.getParent();
            const rootState = rootNavigation?.getState();
            if (rootNavigation !== undefined && rootState?.type === 'stack' && rootState.routes.length > 1) {
              const baseTabsState = rootState.routes[0]?.state;
              rootNavigation.dispatch(StackActions.popToTop());

              if (baseTabsState?.key !== undefined) {
                rootNavigation.dispatch({ ...CommonActions.navigate(tab), target: baseTabsState.key });

                if (tab === 'home') {
                  const homeStackState = baseTabsState.routes.find((route) => route.name === 'home')?.state;
                  if (homeStackState?.key !== undefined) {
                    rootNavigation.dispatch({
                      ...CommonActions.navigate('index'),
                      target: homeStackState.key,
                    });
                  }
                }
              }
              return;
            }

            /*
              마이페이지·추천 탭은 누르면 **입구(index)로 스택을 리셋**한다. 재탭이든 다른
              탭에서 넘어오든 같다.

              접기(popToTop)가 아니라 리셋인 이유: 등록 완료 흐름이 오늘 핀 목록을 이 스택의
              **뿌리로** 심는다(그 흐름의 제약은 `write/index.tsx`에 적혀 있다). 접기는
              뿌리까지만 가서, 그 뒤로는 탭을 눌러도 입구가 나오지 않았다. 홈·채팅·작성의
              동작은 그대로 둔다.
            */
            if (RESET_ON_LEAVE.has(tab)) {
              const childStackKey = state.routes.find((route) => route.name === tab)?.state?.key;

              if (childStackKey !== undefined) {
                navigation.dispatch({
                  ...CommonActions.reset({ index: 0, routes: [{ name: 'index' }] }),
                  target: childStackKey,
                });
              }
            }

            const currentRoute = state.routes[state.index];

            if (currentRoute?.name !== tab) {
              // 네비게이터의 이동을 그대로 쓴다. 각 탭이 들고 있던 스택 위치가 유지된다.
              navigation.navigate(tab);
            }
          }}
        />
      )}
    >
      {/* 화면 등록만 한다. 표시는 전부 AppTabBar가 맡는다. */}
      {APP_TABS.map(({ key, label }) => (
        <Tabs.Screen
          key={key}
          name={key}
          options={{
            title: label,
            // 벗어나면 첫 화면으로 접는 탭. 나머지 탭의 스택 위치는 그대로 유지된다.
            ...(RESET_ON_LEAVE.has(key) ? { popToTopOnBlur: true } : null),
          }}
        />
      ))}
    </Tabs>
  );
}
