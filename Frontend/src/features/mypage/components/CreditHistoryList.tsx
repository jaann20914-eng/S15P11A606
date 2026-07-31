import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { creditFlowLabel } from '@/types/mypage';
import type { CreditEntry } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface CreditHistoryListProps {
  entries: CreditEntry[];
  loading: boolean;
}

/** 크레딧 변동 내역. 적립은 초록, 사용은 회색으로 구분한다. */
export function CreditHistoryList({ entries, loading }: CreditHistoryListProps) {
  return (
    <View style={[s.listCard, s.creditListCard]}>
      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      ) : entries.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>조건에 맞는 내역이 없어요.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {entries.map((entry, index) => {
            const earned = entry.flow === 'EARNED';

            return (
              <View key={entry.entryId} style={[s.creditRow, index < entries.length - 1 && s.rowBorder]}>
                <View style={[s.signBox, earned ? s.earnBox : s.useBox]}>
                  <Text style={s.sign}>{earned ? '+' : '−'}</Text>
                </View>

                <View style={s.creditCopy}>
                  <Text style={s.creditTitle}>{entry.title}</Text>
                  <Text style={s.creditMeta}>
                    {entry.occurredAt} · {creditFlowLabel[entry.flow]}
                  </Text>
                </View>

                <Text style={[s.amount, earned && s.amountEarn]}>
                  {earned ? `+ ${entry.amount}` : `- ${Math.abs(entry.amount)}`}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
