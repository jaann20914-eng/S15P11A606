import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { creditFlowLabel } from '@/types/mypage';
import type { CreditEntry } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface CreditHistoryListProps {
  entries: CreditEntry[];
  loading: boolean;
  /** 다음 페이지를 받는 중인지. 목록 아래에 스피너를 둔다. */
  loadingMore: boolean;
  /** 실패 문구. 목록이 비어 있을 때만 보여준다. */
  error: string | null;
  /** 목록 끝에 닿으면 부른다. */
  onEndReached: () => void;
  /** 한 페이지에 받아오는 개수. 그리는 단위를 여기에 맞춘다. */
  pageSize: number;
}

/**
 * 크레딧 변동 내역. 적립은 초록, 사용은 회색으로 구분한다.
 *
 * `FlatList`를 쓰는 이유는 커서 페이지네이션이다. 목록 끝에 닿을 때 다음 페이지를 이어 받아야
 * 하는데 `ScrollView`에는 그 시점을 알려 주는 수단이 없다.
 */
export function CreditHistoryList({
  entries,
  loading,
  loadingMore,
  error,
  onEndReached,
  pageSize,
}: CreditHistoryListProps) {
  /**
   * 사용자가 한 번이라도 스크롤했는지.
   *
   * `FlatList`는 초기 레이아웃 단계에서 조건이 맞으면 스크롤 전에도 `onEndReached`를 부른다.
   * 그러면 다음 페이지가 미리 받아져 있어, 정작 바닥까지 내렸을 때는 받을 것이 없어 스피너가
   * 돌지 않는다. 첫 페이지와 두 번째 페이지 사이에서만 그렇게 보인다.
   */
  const scrolled = useRef(false);

  const markScrolled = useCallback(() => {
    scrolled.current = true;
  }, []);

  const requestMore = useCallback(() => {
    if (scrolled.current) onEndReached();
  }, [onEndReached]);

  if (loading) {
    return (
      <View style={[s.listCard, s.creditListCard]}>
        <View style={s.loading}>
          <ActivityIndicator color={colors.lime} />
        </View>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={[s.listCard, s.creditListCard]}>
        <View style={s.empty}>
          <Text style={s.emptyText}>{error ?? '조건에 맞는 내역이 없어요.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.listCard, s.creditListCard]}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.entryId)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        onEndReached={requestMore}
        // 손가락이 목록에 닿아 끌기 시작하는 시점. 이때부터 이어 받기를 허용한다.
        onScrollBeginDrag={markScrolled}
        /*
          끝에 가까워지면 미리 받는다. 0.4처럼 넉넉히 두면 사용자가 바닥에 닿기 전에 데이터가
          도착해 스피너가 보일 때와 안 보일 때가 갈린다. 좁혀 두면 늘 바닥에서 받는다.
        */
        onEndReachedThreshold={0.15}
        /*
          받아오는 단위와 그리는 단위를 맞춘다. 기본값은 둘 다 10이라 한 페이지 20개가 10개씩
          두 번에 나눠 그려지고, 그 사이 스피너가 끼었다 빠져 건너뛰는 것처럼 보였다.
        */
        initialNumToRender={pageSize}
        maxToRenderPerBatch={pageSize}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.lime} style={s.listFooter} /> : null
        }
        renderItem={({ item, index }) => {
          const earned = item.flow === 'EARNED';

          return (
            <View style={[s.creditRow, index < entries.length - 1 && s.rowBorder]}>
              <View style={[s.signBox, earned ? s.earnBox : s.useBox]}>
                <Text style={s.sign}>{earned ? '+' : '−'}</Text>
              </View>

              <View style={s.creditCopy}>
                <Text style={s.creditTitle}>{item.title}</Text>
                <Text style={s.creditMeta}>
                  {item.occurredAt} · {creditFlowLabel[item.flow]}
                </Text>
              </View>

              <Text style={[s.amount, earned && s.amountEarn]}>
                {earned ? `+ ${item.amount}` : `- ${Math.abs(item.amount)}`}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}
