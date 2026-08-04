import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { ChatPinListItem } from '@/types/chat';
import { splitAddress } from '@/utils/address';
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
  /*
    주소 끝의 괄호(법정동)를 아랫줄로 내린다. 한 줄로 두면 좁은 화면에서 그 괄호 때문에 도로명이
    잘려, 정작 필요한 부분이 가려진다. 괄호가 없는 주소는 한 줄로 남는다.
  */
  const { street, region } = splitAddress(pin.placeAddress);

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={s.postRow}>
      {/* 시각을 장소 이름과 한 선에 두려고 둘을 한 덩어리로 묶는다. `postBody` 주석 참고. */}
      <View style={s.postBody}>
        <View style={s.timePill}>
          <Text style={s.timePillText}>{formatTimeOfDay(pin.createdAt)}</Text>
        </View>

        <View style={s.rowCopy}>
          <Text numberOfLines={1} style={s.rowTitle}>
            {pin.placeName}
          </Text>
          <Text numberOfLines={1} style={s.address}>
            {street}
          </Text>
          {region !== null && (
            <Text numberOfLines={1} style={s.addressRegion}>
              {region}
            </Text>
          )}
        </View>
      </View>

      {/* 안 읽은 방이 있으면 점을 둔다. 어느 글부터 볼지 한눈에 고를 수 있다. */}
      {pin.hasUnread && <View style={s.unread} />}

      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </Pressable>
  );
}
