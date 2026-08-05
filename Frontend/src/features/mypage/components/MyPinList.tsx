import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { MyPin } from '@/types/mypage';
import type { TodayPinStatus } from '@/types/pin';
import { mypageStyles as s } from '../styles';

export interface MyPinListProps {
  pins: MyPin[];
  loading: boolean;
  /** 다음 페이지를 받는 중인지. 목록 아래에 스피너를 둔다. */
  loadingMore: boolean;
  /** 아직 더 받을 것이 있는지. 개수 표기에 쓴다. */
  hasMore: boolean;
  /** 실패 문구. 목록이 비어 있을 때만 보여준다. */
  error: string | null;
  /** 목록 끝에 닿으면 부른다. */
  onEndReached: () => void;
  /** 한 페이지에 받아오는 개수. 그리는 단위를 여기에 맞춘다. */
  pageSize: number;
}

/**
 * 상태별 문구.
 *
 * 검수에서 걸러진 것(`RESHOOT`)과 처리에 실패한 것(`FAILED`)은 사용자가 할 일이 다르다 —
 * 앞은 다시 찍어야 하고 뒤는 다시 올려야 한다. 한 문구로 뭉치면 무엇을 해야 하는지 알 수 없다.
 */
const statusLabel: Record<TodayPinStatus, string> = {
  PROCESSING: '게시 대기중',
  ACTIVE: '게시 완료',
  RESHOOT: '다시 촬영 필요',
  FAILED: '등록 실패',
};

/** 상세를 열 수 있는 상태인지. 공개된 핀만 조회된다. */
function isOpenable(status: TodayPinStatus): boolean {
  return status === 'ACTIVE';
}

/**
 * 오늘 작성한 영상핀 목록.
 *
 * 처리 중이거나 재촬영이 필요한 핀은 상세를 열 수 없다. 공개되지 않은 상태라 조회되지 않는다.
 */
export function MyPinList({
  pins,
  loading,
  loadingMore,
  hasMore,
  error,
  onEndReached,
  pageSize,
}: MyPinListProps) {
  /**
   * 사용자가 한 번이라도 스크롤했는지.
   *
   * `FlatList`는 초기 레이아웃 단계에서도 `onEndReached`를 부른다. 그러면 다음 페이지가 미리
   * 받아져, 정작 바닥까지 내렸을 때는 받을 것이 없어 스피너가 돌지 않는다.
   */
  const scrolled = useRef(false);

  const markScrolled = useCallback(() => {
    scrolled.current = true;
  }, []);

  const requestMore = useCallback(() => {
    if (scrolled.current) onEndReached();
  }, [onEndReached]);

  return (
    <>
      <View style={s.pinSummaryRow}>
        <Text style={s.pinSummary}>오늘 등록한 영상 핀</Text>
        {/*
          서버가 전체 개수를 주지 않는다. 받아온 만큼만 세므로, 더 남아 있으면 그 사실을
          함께 적어야 지금 숫자가 전부인 것처럼 읽히지 않는다.
        */}
        {!loading && (
          <Text style={s.pinCount}>
            {pins.length}개{hasMore ? ' 이상' : ''}
          </Text>
        )}
      </View>

      <View style={s.listCard}>
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : pins.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>{error ?? '오늘 등록한 영상핀이 없어요.'}</Text>
          </View>
        ) : (
          <FlatList
            data={pins}
            keyExtractor={(pin) => String(pin.pinId)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            onEndReached={requestMore}
            onScrollBeginDrag={markScrolled}
            onEndReachedThreshold={0.15}
            initialNumToRender={pageSize}
            maxToRenderPerBatch={pageSize}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={colors.gray400} style={s.listFooter} /> : null
            }
            renderItem={({ item, index }) => {
              const openable = isOpenable(item.status);
              /*
                만료된 글은 상태 문구를 "만료된 글"로 바꾼다. "게시 완료"로 남아 있으면 아직
                공개 중인 것으로 읽힌다. 줄은 그대로 눌 수 있다 — 작성자는 만료 후에도 상세를
                볼 수 있고, 거기서 삭제할 수 있다(수정만 잠긴다).
              */
              const label = item.expired ? '만료된 글' : statusLabel[item.status];

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !openable }}
                  accessibilityHint={
                    openable ? '작성한 영상핀 상세 보기' : '공개되기 전에는 상세를 열 수 없습니다'
                  }
                  disabled={!openable}
                  onPress={() => router.push(`/pin/${item.pinId}`)}
                  style={[s.pinRow, index < pins.length - 1 && s.rowBorder]}
                >
                  <View style={s.timePill}>
                    <Text style={s.time}>{item.time}</Text>
                  </View>

                  <View style={s.pinCopy}>
                    <Text style={s.place}>{item.placeName}</Text>
                    {/* 주소가 비어 있으면 줄을 그리지 않는다. 빈 줄이 자리만 차지한다. */}
                    {item.placeAddress !== '' && (
                      <Text numberOfLines={1} style={s.address}>
                        {item.placeAddress}
                      </Text>
                    )}
                    <Text style={[s.pinState, (!openable || item.expired) && s.pinStatePending]}>
                      {label}
                    </Text>
                  </View>

                  {openable && <Ionicons name="chevron-forward" size={23} color={colors.gray400} />}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </>
  );
}
