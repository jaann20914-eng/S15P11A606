import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        태그 결과도 **홈 지도를 살려 둔 채** 겹친다.

        이 화면 위에서 장소 상세(`place/[placeId]`)를 연다. 그 화면은 자기 지도를 만들지 않고
        **아래 깔린 홈 지도를 그대로 비추는 반투명 화면**이라, 바로 아래에 홈이 살아 있어야
        지도가 보인다. 보통 push로 두면 이 화면이 홈을 덮어 버려서(불투명 씬) 상세를 열었을 때
        지도 자리가 이 화면의 흰 목록으로 채워졌다 — 스와이프 카드와 내 위치 버튼만 태그 목록
        위에 겹쳐 뜨던 것이 이것이다(2026-08-05).

        `transparentModal`로 두면 홈이 붙은 채로 남는다. 이 화면 자체는 자기 상자에 흰 배경을
        칠하므로 보이는 모습은 그대로고, 위에 상세가 올라오면 내용을 감춰(`display: 'none'`)
        홈 지도가 드러난다 — 홈이 상세에게 하는 것과 같은 처리다.

        씬 배경까지 투명해야 한다. 위 `app/_layout.tsx`의 `contentStyle`이 모든 씬을 칠하므로
        이 줄이 없으면 반투명으로 띄워도 아래 홈이 사라진다.
      */}
      <Stack.Screen
        name="tag/[tag]"
        options={{
          presentation: 'transparentModal',
          // 슬라이드는 반투명 씬과 함께 쓰면 빈 화면이 먼저 밀려 들어온다. 상세·미등록 장소와 같은 값이다.
          animation: 'fade',
          animationDuration: 220,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />

      {/*
        검색도 태그 결과와 같은 방식으로 겹친다.

        검색에서 고른 장소 상세(결과 화면)는 검색을 **닫지 않고 그 위에 얹힌다** — 그래야
        결과에서 뒤로 가기가 검색으로 돌아온다(지도 앱들의 구조). 그 상세는 아래 홈 지도를
        비추는 반투명 화면이라, 검색이 불투명 씬으로 남아 있으면 지도 대신 흰 목록이 비친다.
        태그 결과가 밟았던 것과 같은 문제라 같은 처리를 한다 — 반투명 씬으로 두고, 화면
        스스로 흰 배경을 칠하고, 위에 다른 화면이 오면 내용을 감춘다(`display: 'none'`).
      */}
      <Stack.Screen
        name="search"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          animationDuration: 220,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
