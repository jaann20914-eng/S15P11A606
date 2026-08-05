import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewAvatar } from '@/components/common';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { formatRelativeTime } from '@/utils/datetime';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 장소에 달린 영상핀 카드.
 *
 * 원본은 장소 상세 화면(`app/place/[placeId]/index.tsx`)의 `VideoCard`다. 레이아웃·간격·
 * 그림자를 그대로 옮기고, 고정 문구 대신 서버 응답(`pins[]`)을 받도록 바꿨다. 작성자 링만
 * 공용 `ViewAvatar`로 교체했다 — 각도마다 링 모양이 달라야 해서다.
 *
 * **장소 상세 담당자에게**: 그 화면의 지역 `VideoCard`를 지우고 이걸 import 하면 한 벌로
 * 합쳐진다. 값은 `GET /api/v1/places/{placeId}`의 `pins`를 그대로 넘기면 된다.
 */

export interface PlacePinCardProps {
  pin: PlacePinCardData;
  onPress: () => void;
  /**
   * 지금 지도 중앙에 정렬된 영상핀인지.
   *
   * 홈의 장소 카드와 같은 양식으로 라임 테두리를 둘러 "지도에 보이는 그 핀"임을 알린다.
   */
  selected?: boolean;
  /**
   * 선택 테두리 색. 기본은 라임이다.
   *
   * 추천의 와글 계열은 지도 핀이 붉은 계열이라 테두리도 같은 계열이어야 한다 — 지도와 카드가
   * 다른 색으로 같은 핀을 가리키면 짝이 아닌 것처럼 보인다.
   */
  selectedColor?: string;
}

/** 카드의 각도 링 지름. */
const ANGLE_RING_SIZE = 44;

/**
 * 메모를 몇 줄까지 보여줄지.
 *
 * `numberOfLines`로 자른다 — 넘치는 지점부터 RN이 말줄임표를 붙여 준다. 예전에는 글자 수
 * (82자)로 잘라 `… 더보기`를 직접 붙였는데, 그러면 **글자 수가 같아도 줄 수가 달라진다.**
 * 화면 너비와 글자 조합에 따라 세 줄이 되기도 네 줄이 되기도 해서 카드 높이가 제각각이었다.
 * 줄 수로 자르면 어느 카드든 같은 높이에서 끝난다.
 *
 * `더보기` 글자는 없어진다. 말줄임표 뒤에 글자를 붙일 수단이 없기 때문이다. 카드 전체가
 * 게시글로 가는 버튼이라 눌러서 이어 읽는 길은 그대로 남는다.
 *
 * 아래 `THUMBNAIL_HEIGHT`에서 태그 줄을 뺀 만큼이 이 줄 수의 근거다(계산은 그쪽 주석 참고).
 */
const MEMO_MAX_LINES = 4;

/** 썸네일이 아직 없을 때 쓰는 자리. 시안의 카드 색을 따른다. */
const THUMBNAIL_TINT = ['#A9D6CC', '#D9E9A8'] as const;

/**
 * 썸네일 칸의 크기. **이 세로 높이가 카드 높이를 정한다.**
 *
 * 들어갈 것이 **영상**이라 정사각(128×128)보다 옆으로 누운 편이 원본 화면비에 가깝다.
 *
 * 세로를 최소값이 아니라 **고정값**으로 둔다. 예전에는 최소값이라 옆 글줄이 길면 함께
 * 늘어났고, 그래서 메모가 긴 카드만 키가 컸다. 한 장씩 넘겨 보는 자리에서는 카드마다 키가
 * 다르면 넘길 때 아래가 들쭉날쭉해 보인다.
 *
 * 이 높이가 옆 칸의 예산이 된다 — 태그 줄(28 + 위 여백 8 = 36)을 빼면 92가 남고,
 * 메모 한 줄이 22px(`type.small`의 lineHeight)이라 네 줄(88)이 들어간다. 그래서
 * `MEMO_MAX_LINES`가 4다. 이 값을 바꾸면 그 줄 수도 함께 다시 계산해야 한다.
 *
 * 가로를 더 늘리면 옆 메모 칸이 그만큼 좁아져 한 줄에 담기는 글자가 줄어든다. 지금 값이
 * 메모가 읽히는 선에서 가장 넓게 잡은 것이다.
 */
const THUMBNAIL_WIDTH = 152;
const THUMBNAIL_HEIGHT = 128;

/**
 * 열람 전 썸네일에 거는 블러 반경(dp).
 *
 * **결제하지 않은 사람에게는 현장이 보이지 않아야 한다.** 썸네일은 현장 영상의 한 장면이라
 * 상세 화면의 영상과 같은 기준으로 가린다(`revealsVideo`) — 한쪽만 선명하면 목록을 훑는
 * 것만으로 현장을 볼 수 있어 크레딧을 쓸 이유가 없어진다.
 *
 * 가리는 수단은 상세 화면과 같은 `filter`다(`PinDetailMedia`의 `PREVIEW_BLUR_RADIUS` 설명에
 * `expo-blur`와 축소·확대가 왜 안 되는지 적어 두었다). 상세는 화면 너비(약 390dp)에 24를
 * 쓰는데, 여기서는 칸이 152dp라 **같은 비율(약 6%)이 되는 10**을 쓴다. 크기가 다른 자리에
 * 같은 값을 쓰면 작은 칸은 통째로 뭉개진다.
 */
const PREVIEW_BLUR_RADIUS = 10;

/**
 * 블러를 걸 때 그림을 이만큼 키워 넣는다.
 *
 * `filter`는 칸 밖의 **투명한 바깥까지 섞어** 흐리게 하므로, 그림을 칸에 딱 맞게 두면
 * 네 변이 옅게 사라져 카드 흰 바닥이 비친다. 반경만큼 넉넉히 키워 그 옅은 띠를 칸 밖으로
 * 밀어내고 잘라 낸다 — 필요한 최소는 `1 + 2 × 10 / 128 ≒ 1.16`이라 여유를 둔 값이다.
 */
const PREVIEW_BLUR_OVERSCAN = 1.25;

export function PlacePinCard({ pin, onPress, selected = false, selectedColor }: PlacePinCardProps) {
  /*
    메모는 없을 수 있다(등록 때 선택 입력). 예전에는 바로 `pin.memo.length`를 읽어서, 메모
    없이 등록된 핀이 목록에 하나만 있어도 카드가 아니라 화면 전체가 죽었다.
  */
  const memo = pin.memo ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pin.nickname}님의 영상핀 보기`}
      onPress={onPress}
      style={[
        s.card,
        selected && s.cardSelected,
        selected && selectedColor !== undefined && { borderColor: selectedColor },
      ]}
    >
      <View style={s.author}>
        <ViewAvatar angle={pin.viewAngle} size={ANGLE_RING_SIZE} />
        <View style={s.authorCopy}>
          <Text style={s.authorName}>{pin.nickname}</Text>
          <Text style={s.time}>{formatRelativeTime(pin.createdAt)}</Text>
        </View>
      </View>

      <View style={s.body}>
        {/*
          서버가 주는 썸네일은 **AI가 얼굴만 가린 영상의 한 장면**이라 현장이 그대로 보인다.
          열람 전에 가리는 일은 상세 화면의 영상과 마찬가지로 화면이 한다(`pin.revealed`).

          주소는 목록 응답에 담겨 오지 않아 화면이 핀마다 따로 받아 채운다
          (`features/place-detail/hooks/usePinThumbnails.ts`). 그래서 카드가 먼저 그려지고
          썸네일이 나중에 들어온다 — **비어 있는 동안에도 자리는 그대로 있어야 한다.**
          받지 못한 핀은 계속 색 자리로 남는다.
        */}
        {pin.thumbnailUrl === null ? (
          <LinearGradient colors={THUMBNAIL_TINT} style={s.thumbnail} />
        ) : pin.revealed ? (
          <Image source={{ uri: pin.thumbnailUrl }} style={s.thumbnail} />
        ) : (
          /*
            열람 전에는 가린다. 반경·확대 이유는 위 `PREVIEW_BLUR_RADIUS` 설명에 있다.

            바깥 칸이 자르고(`overflow: hidden`) 안쪽이 흐린 그림을 키워 채운다. 자르는 칸과
            흐리게 하는 칸을 나눈 이유는, 같은 뷰에 `filter`와 `overflow`를 함께 걸면 잘린
            결과가 아니라 자르기 전 그림이 흐려져 옅은 띠가 그대로 남기 때문이다.
          */
          <View style={s.thumbnailClip}>
            <View style={s.thumbnailBlur}>
              <Image source={{ uri: pin.thumbnailUrl }} style={s.thumbnailOverscan} />
            </View>
          </View>
        )}

        <View style={s.copy}>
          {/*
            **비어 있어도 자리를 비우지 않되, 글자로 알리지도 않는다.**

            메모와 태그는 등록할 때 선택 입력이라 없는 핀이 흔하다. 자리를 통째로 접으면 그
            카드만 오른쪽이 텅 비어 값이 없는 것인지 덜 그려진 것인지 구분되지 않는다. 그래서
            예전에는 `내용 없음`·`태그 없음`을 적었는데, **한 카드에 "없음"이 두 번 쌓여** 읽을
            것이 없는 카드가 오히려 글자로 시끄러워졌다(팀 의견, 2026-08-05).

            지금은 값이 없는 자리에 **줄표(—) 하나**만 둔다. 표에서 빈 칸을 적는 방식이라 뜻이
            바로 읽히고, 눈에 걸리지 않으면서 자리는 지킨다. 태그 쪽은 칩 모양을 유지해 "태그가
            들어올 자리"라는 것까지 보인다.

            **읽어 주는 쪽에는 그대로 말로 알린다**(`accessibilityLabel`) — 줄표는 눈으로 볼 때만
            뜻이 통하기 때문이다.
          */}
          {memo.length > 0 ? (
            <Text numberOfLines={MEMO_MAX_LINES} ellipsizeMode="tail" style={s.memo}>
              {memo}
            </Text>
          ) : (
            <Text accessibilityLabel="남긴 메모 없음" style={s.emptyMark}>
              —
            </Text>
          )}

          {/* 태그 칩 줄은 늘 같은 높이를 차지해 카드 안의 리듬이 태그 유무로 달라지지 않는다. */}
          <View style={s.tags}>
            {pin.tags.length > 0 ? (
              pin.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={s.tagText}>
                    #{tag}
                  </Text>
                </View>
              ))
            ) : (
              <View accessibilityLabel="태그 없음" style={[s.tag, s.tagEmpty]}>
                <Text style={s.emptyMark}>—</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  /**
   * 카드 한 장.
   *
   * 그림자를 둔다. 이 카드는 반투명 시트 위에 놓이는데 그림자가 없으면 시트 바닥과 붙어
   * 한 덩어리로 보인다. 홈 시트의 장소 카드와 같은 옅은 그림자를 쓴다(§1.5의 지도 위 카드).
   */
  card: {
    padding: spacing.x4,
    borderRadius: radius.hero,
    /*
      테두리 자리를 고르지 않았을 때도 비워 둔다(투명). 고를 때만 주면 그 카드가 3px 높아져
      한 장씩 넘기는 칸에서 아래가 잘린다 — 홈의 장소 카드와 같은 이유다.
    */
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  /** 지도 중앙에 정렬된 영상핀. 홈의 선택된 장소 카드와 같은 양식이다. */
  cardSelected: { borderColor: colors.lime },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  authorCopy: { flex: 1 },
  authorName: { ...type.label, fontWeight: '600', color: colors.dark },
  time: { ...type.caption, color: colors.gray400 },
  // 높이를 고정해 카드마다 키가 같아진다. 근거는 `THUMBNAIL_HEIGHT` 주석에 있다.
  body: {
    height: THUMBNAIL_HEIGHT,
    flexDirection: 'row',
    gap: spacing.x3,
    marginTop: spacing.x3,
  },
  thumbnail: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT, borderRadius: radius.md },
  /** 열람 전 썸네일을 담는 칸. 흐려서 번진 가장자리를 여기서 자른다. */
  thumbnailClip: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailBlur: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    filter: [{ blur: PREVIEW_BLUR_RADIUS }],
  },
  thumbnailOverscan: {
    width: THUMBNAIL_WIDTH * PREVIEW_BLUR_OVERSCAN,
    height: THUMBNAIL_HEIGHT * PREVIEW_BLUR_OVERSCAN,
  },
  copy: { flex: 1, minWidth: 0 },
  memo: { ...type.small, color: colors.gray600 },
  /**
   * 값이 없는 자리에 두는 줄표.
   *
   * 메모와 태그가 같은 표시를 쓴다 — 둘이 다르면 하나는 값처럼, 하나는 안내처럼 읽힌다.
   * 글자보다 옅게 두어 카드를 훑을 때 걸리지 않게 한다.
   */
  emptyMark: { ...type.small, color: colors.gray400 },
  /**
   * 태그 칩 줄. **썸네일 아랫변에 맞춰 바닥에 붙인다.**
   *
   * `marginTop: 'auto'`가 남는 높이를 위로 몰아 이 줄을 칸 맨 아래로 내린다. 옆 칸의 높이는
   * 썸네일 높이로 고정돼 있으므로(`body`), 결과적으로 태그 줄의 아랫변이 썸네일 아랫변과 같은
   * 선에 놓인다 — 메모가 한 줄이든 네 줄이든 카드마다 같은 자리다.
   *
   * 태그가 없을 때도 이 줄과 높이가 그대로 있어 `태그 없음`이 같은 선에 놓인다.
   */
  tags: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x1,
    marginTop: 'auto',
    overflow: 'hidden',
  },
  /** 태그가 없을 때의 칩. 색만 빼고 모양은 같게 두어 "들어올 자리"로 읽힌다. */
  tagEmpty: { minWidth: 44, backgroundColor: colors.gray100 },
  tag: {
    maxWidth: '45%',
    height: 28,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x2,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  tagText: { ...type.caption, flexShrink: 1, color: colors.gray600 },
});
