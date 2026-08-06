import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { chatListStyles as s } from '../styles';

export interface ChatListStateProps {
  loading: boolean;
  error: string | null;
  /** 목록이 비었을 때 보여줄 문구. */
  emptyText: string;
  /** 항목이 하나라도 있으면 아무것도 그리지 않는다. */
  isEmpty: boolean;
  onRetry: () => void;
}

/**
 * 불러오는 중 · 실패 · 빈 목록을 한 자리에서 그린다.
 *
 * 세 경우를 목록마다 따로 쓰면 문구와 여백이 조금씩 달라진다. 실패에는 다시 시도를 붙인다 —
 * 목록 조회는 다시 눌러 보면 되는 실패가 대부분이다.
 */
export function ChatListState({ loading, error, emptyText, isEmpty, onRetry }: ChatListStateProps) {
  if (loading) {
    return (
      <View style={s.state}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={s.state}>
        <Text style={s.stateText}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
          <Text style={s.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={s.state}>
        <Text style={s.stateText}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}
