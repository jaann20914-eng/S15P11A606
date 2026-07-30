import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { MyPin } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface MyPinListProps {
  pins: MyPin[];
  loading: boolean;
}

/** 상태별 문구. 블러 처리가 끝나야 공개된다. */
const stateLabel = { PENDING: '게시 대기중', PUBLISHED: '게시 완료' } as const;

/**
 * 오늘 작성한 영상핀 목록.
 *
 * 처리 대기 중인 핀은 상세를 열 수 없다. 공개되지 않은 상태라 조회되지 않는다.
 */
export function MyPinList({ pins, loading }: MyPinListProps) {
  return (
    <>
      <View style={s.pinSummaryRow}>
        <Text style={s.pinSummary}>오늘 등록한 영상 핀</Text>
        <Text style={s.pinCount}>{pins.length}개</Text>
      </View>

      <View style={s.listCard}>
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : pins.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>오늘 등록한 영상핀이 없어요.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
            {pins.map((pin, index) => {
              const pending = pin.state === 'PENDING';

              return (
                <Pressable
                  key={pin.pinId}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending }}
                  accessibilityHint={
                    pending ? 'AI 블러 처리 중에는 상세 페이지를 열 수 없습니다' : '작성한 영상핀 상세 보기'
                  }
                  disabled={pending}
                  onPress={() => router.push(`/pin/${pin.pinId}`)}
                  style={[s.pinRow, index < pins.length - 1 && s.rowBorder]}
                >
                  <View style={s.timePill}>
                    <Text style={s.time}>{pin.createdAt}</Text>
                  </View>

                  <View style={s.pinCopy}>
                    <Text style={s.place}>{pin.placeName}</Text>
                    <Text numberOfLines={1} style={s.address}>
                      {pin.placeAddress}
                    </Text>
                    <Text style={[s.pinState, pending && s.pinStatePending]}>{stateLabel[pin.state]}</Text>
                  </View>

                  {!pending && <Ionicons name="chevron-forward" size={23} color={colors.gray400} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}
