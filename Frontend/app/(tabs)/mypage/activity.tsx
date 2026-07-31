import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MyPinList } from '@/features/mypage/components/MyPinList';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { TODAY_PIN_PAGE_SIZE, useMyPins } from '@/features/mypage/hooks/useMyPins';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 오늘 작성한 영상핀 목록.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function MyPinsScreen() {
  const { pins, loading, loadingMore, hasMore, error, loadMore } = useMyPins();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <MypageHeader title="작성한 영상핀" />

        <View style={s.content}>
          <MyPinList
            pins={pins}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            error={error}
            onEndReached={loadMore}
            pageSize={TODAY_PIN_PAGE_SIZE}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
