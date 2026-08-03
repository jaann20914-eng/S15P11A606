import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { ChatPinListItem } from '@/types/chat';
import { formatTimeOfDay } from '@/utils/datetime';
import { chatListStyles as s } from '../styles';

export interface ChatPinRowProps {
  pin: ChatPinListItem;
  onOpen: () => void;
}

/**
 * 요청이 온 내 게시글 한 줄.
 *
 * 채팅방 줄과 같은 높이를 쓴다(`styles`의 `ROW_MIN_HEIGHT`). 탭을 옮길 때 줄 높이가 달라지면
 * 같은 목록이 아닌 것처럼 보인다. 내용은 시각 · 장소 · 주소로 두고, 대화는 눌러 들어가서 본다.
 */
export function ChatPinRow({ pin, onOpen }: ChatPinRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={s.postRow}>
      <View style={s.timePill}>
        <Text style={s.timePillText}>{formatTimeOfDay(pin.createdAt)}</Text>
      </View>

      <View style={s.rowCopy}>
        <Text numberOfLines={1} style={s.rowTitle}>
          {pin.placeName}
        </Text>
        <Text numberOfLines={1} style={s.address}>
          {pin.placeAddress}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </Pressable>
  );
}
