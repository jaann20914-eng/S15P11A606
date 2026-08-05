import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditBalanceCard } from '@/features/mypage/components/CreditBalanceCard';
import { CreditFilterBar } from '@/features/mypage/components/CreditFilterBar';
import { CreditHistoryList } from '@/features/mypage/components/CreditHistoryList';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { CREDIT_PAGE_SIZE, useCreditHistory } from '@/features/mypage/hooks/useCreditHistory';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 크레딧 내역.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 *
 * 잔액은 내역 응답에서 온다. 목록과 같은 원장에서 나오는 값이라 `/users/me`를 따로 부르면
 * 두 요청 사이에 거래가 생겼을 때 화면 안에서 숫자가 어긋난다.
 */
export default function CreditsScreen() {
  const history = useCreditHistory();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <MypageHeader title="와글 포인트 내역" />

        <View style={s.content}>
          <CreditBalanceCard balance={history.balance} />

          <CreditFilterBar
            filter={history.filter}
            period={history.period}
            periodOpen={history.periodOpen}
            onFilterChange={history.setFilter}
            onPeriodChange={history.setPeriod}
            onTogglePeriod={history.togglePeriod}
          />

          <CreditHistoryList
            entries={history.entries}
            loading={history.loading}
            loadingMore={history.loadingMore}
            error={history.error}
            onEndReached={history.loadMore}
            pageSize={CREDIT_PAGE_SIZE}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
