import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditBalanceCard } from '@/features/mypage/components/CreditBalanceCard';
import { CreditFilterBar } from '@/features/mypage/components/CreditFilterBar';
import { CreditHistoryList } from '@/features/mypage/components/CreditHistoryList';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { useCreditHistory } from '@/features/mypage/hooks/useCreditHistory';
import { useMypageSummary } from '@/features/mypage/hooks/useMypageSummary';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 크레딧 내역.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function CreditsScreen() {
  const { summary } = useMypageSummary();
  const history = useCreditHistory();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <MypageHeader title="크레딧 내역" />

        <View style={s.content}>
          <CreditBalanceCard balance={summary?.creditBalance ?? 0} />

          <CreditFilterBar
            filter={history.filter}
            period={history.period}
            periodOpen={history.periodOpen}
            onFilterChange={history.setFilter}
            onPeriodChange={history.setPeriod}
            onTogglePeriod={history.togglePeriod}
          />

          <CreditHistoryList entries={history.entries} loading={history.loading} />
        </View>
      </View>
    </SafeAreaView>
  );
}
