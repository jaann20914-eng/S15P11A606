import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewAvatar } from '@/components/common';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { SUPPORTS_FILTER_BLUR } from '@/utils/blurSupport';
import { formatRelativeTime } from '@/utils/datetime';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 장소에 달린 핀 카드.
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
   * 지금 지도 중앙에 정렬된 핀인지.
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

/**
 * 메모가 없을 때 그 자리에 두는 한 마디.
 *
 * **줄바꿈을 글에 박아 둔다.** 저절로 접히게 두면 칸 너비와 기기 글꼴 크기에 따라 끊기는
 * 자리가 달라져, 같은 목록 안에서 카드마다 다른 모양이 된다. 첫 줄을 못 박아 어느 카드에서든
 * 같은 두 줄로 읽히게 한다(2026-08-07 지정 문구).
 *
 * 둘째 줄은 이 칸(약 173dp)에 **겨우 들어간다** — 14px 글자로 약 162dp다. 기기 글꼴을 크게 쓰면
 * 접혀 세 줄이 될 수 있지만 잘리지는 않는다(`MEMO_MAX_LINES`가 4줄까지 받고 칸 높이도 그만큼
 * 잡혀 있다). 어떤 설정에서도 두 줄이어야 하면 둘째 줄을 더 짧게 줄이면 된다.
 *
 * `내용 없음`처럼 없다는 사실만 적지 않는다. **그 카드에서 볼 것**을 적는 편이 그대로 다음
 * 행동이 된다 — 카드 전체가 그 게시글로 가는 버튼이다.
 */
const EMPTY_MEMO_MESSAGE = '현장의 분위기를\n영상으로 확인해 보세요!';

/** 썸네일이 아직 없을 때 쓰는 자리. 시안의 카드 색을 따른다. */
const THUMBNAIL_TINT = ['#A9D6CC', '#D9E9A8'] as const;

/** 카드 안쪽 여백과 테두리. 아래 카드 높이 계산이 같은 값을 봐야 해서 토큰으로 둔다. */
const CARD_PADDING = spacing.x4;
const CARD_BORDER = 1.5;

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

/**
 * 카드 한 장의 높이. **내용과 무관하게 늘 같다.**
 *
 * 작성자 줄과 본문 칸의 높이가 모두 고정이라 계산으로 나온다(썸네일 높이가 카드 높이를 정한다는
 * 것이 `THUMBNAIL_HEIGHT`의 전제다). 메모가 길든 태그가 없든 이 값이다.
 *
 * **시트의 "보통" 단계 높이를 이 값으로 잡는 화면이 있다.** 장소 상세는 그 단계에 이 카드
 * 한 장을 놓고, 홈은 자기 장소 카드를 놓는데 둘의 키가 달라 **같은 자리의 시트가 47px 어긋나
 * 보였다**(2026-08-05). 홈이 이 값을 하한으로 써서 두 시트가 같은 높이에 선다.
 *
 * 재서 쓰지 않고 계산으로 내놓는 이유: 재려면 카드를 그려 봐야 하고, 홈에는 이 카드가 없다.
 */
export const PLACE_PIN_CARD_HEIGHT =
  CARD_PADDING * 2 + CARD_BORDER * 2 + ANGLE_RING_SIZE + spacing.x3 + THUMBNAIL_HEIGHT;

export function PlacePinCard({ pin, onPress, selected = false, selectedColor }: PlacePinCardProps) {
  /*
    메모는 없을 수 있다(등록 때 선택 입력). 예전에는 바로 `pin.memo.length`를 읽어서, 메모
    없이 등록된 핀이 목록에 하나만 있어도 카드가 아니라 화면 전체가 죽었다.
  */
  const memo = pin.memo ?? '';

  /**
   * 그림까지 다 받은 주소. 아직이면 null.
   *
   * **주소가 왔다고 그림이 온 것은 아니다.** 발급받은 주소를 `Image`에 넘기면 그때부터 네트워크로
   * 받아 오는데, 그동안 칸이 비어 있다가 다 받는 순간 툭 나타났다 — 무엇을 기다리는지 알 수 없어
   * 예측하기 어려운 화면이었다(팀 의견, 2026-08-05). 다 받을 때까지 그 자리에서 표시가 돈다.
   *
   * 주소를 담아 두고 견주는 이유: 주소가 바뀌면(만료돼 다시 발급받으면) 다시 기다려야 한다.
   * 참·거짓만 두면 새 주소를 받는 동안 낡은 "준비됨"이 남는다.
   */
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const waiting = pin.thumbnailUrl === null || loadedUrl !== pin.thumbnailUrl;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pin.nickname}님의 핀 보기`}
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
          {/*
            닉네임 줄. **내 글이면 이름 옆에 표시를 붙인다.**

            닉네임만으로는 내 글인지 알 수 없다 — 같은 이름을 쓰는 사람이 있을 수 있고, 애초에
            로그인한 사람의 닉네임을 앱이 들고 있지도 않다. 판정 근거는 핀 상세의 접근 수준
            하나뿐이고, 그 값이 여기까지 오는 길은 `PlacePinCard.mine`에 적어 두었다.

            이름이 길면 표시부터 밀려나지 않도록 이름 쪽만 줄인다(`flexShrink`).
          */}
          <View style={s.authorRow}>
            <Text numberOfLines={1} style={s.authorName}>
              {pin.nickname}
            </Text>
            {pin.mine && <Text style={s.mineMark}>(나)</Text>}
          </View>
          <Text style={s.time}>{formatRelativeTime(pin.createdAt)}</Text>
        </View>
      </View>

      {/*
        서버가 주는 썸네일은 **AI가 얼굴만 가린 영상의 한 장면**이라 현장이 그대로 보인다.
        열람 전에 가리는 일은 상세 화면의 영상과 마찬가지로 화면이 한다(`pin.revealed`).

        주소는 목록 응답에 담겨 오지 않아 화면이 핀마다 따로 받아 채운다
        (`features/place-detail/hooks/usePinThumbnails.ts`). 그래서 카드가 먼저 그려지고
        썸네일이 나중에 들어온다 — **비어 있는 동안에도 자리는 그대로 있어야 한다.**
        받지 못한 핀은 계속 색 자리로 남는다.
      */}
      <View style={s.body}>
        {/*
          썸네일 칸. **자리는 늘 같다** — 왼쪽 썸네일, 오른쪽 위 내용, 오른쪽 아래 태그.

          한때 내용과 태그가 모두 없으면 썸네일이 카드를 가득 채우게 했다. 그러면 **같은 목록
          안에서 카드마다 썸네일 크기가 달라져** 통일감이 없었다(팀 회의, 2026-08-05). 비어 있는
          자리는 크기를 바꿔 메우지 않고 한 마디 글로 채운다(아래).

          층을 셋 겹친다. 색 자리는 늘 깔려 있어 주소가 없을 때도, 받는 중에도, 받다 실패해도
          칸이 비지 않는다. 그 위에 그림, 그 위에 기다리는 표시다.
        */}
        <View style={s.thumbnail}>
          <LinearGradient colors={THUMBNAIL_TINT} style={s.thumbnailFill} />

          {pin.thumbnailUrl !== null &&
            (pin.revealed ? (
              <Image
                source={{ uri: pin.thumbnailUrl }}
                style={s.thumbnailFill}
                /*
                  성공·실패 어느 쪽이든 불린다. `onLoad`만 보면 실패한 그림에서 표시가 영원히
                  돌아, 받는 중인 것과 못 받은 것이 구분되지 않는다.
                */
                onLoadEnd={() => setLoadedUrl(pin.thumbnailUrl)}
              />
            ) : (
              /*
                열람 전에는 가린다. 반경·확대 이유는 위 `PREVIEW_BLUR_RADIUS` 설명에 있다.

                바깥 칸이 자르고(`overflow: hidden`) 안쪽이 흐린 그림을 키워 채운다. 자르는 칸과
                흐리게 하는 칸을 나눈 이유는, 같은 뷰에 `filter`와 `overflow`를 함께 걸면 잘린
                결과가 아니라 자르기 전 그림이 흐려져 옅은 띠가 그대로 남기 때문이다.
              */
              <View style={s.thumbnailBlur}>
                <Image
                  source={{ uri: pin.thumbnailUrl }}
                  style={s.thumbnailOverscan}
                  /*
                    `filter`가 듣지 않는 기기(안드로이드 11 이하)를 위한 대비. 위 `filter`는
                    그대로 두고 **여기서 한 번 더 흐리게 한다.**

                    이쪽은 영상이 아니라 그림이라 진짜 흐림이 가능하다 — `blurRadius`는 그림을
                    받아서 흐린 비트맵으로 만들어 그리는 오래된 네이티브 구현이라 버전도
                    아키텍처도 가리지 않는다. 그 기기에서 결제 전 현장이 선명하게 보이던 길을
                    이 한 줄이 막는다(`blurSupport` 참고).

                    되는 기기에서는 0을 줘서 아무 일도 하지 않는다. 두 흐림이 겹치면 같은 목록
                    안에서 카드마다 흐린 정도가 달라 보인다.
                  */
                  blurRadius={SUPPORTS_FILTER_BLUR ? 0 : PREVIEW_BLUR_RADIUS}
                  onLoadEnd={() => setLoadedUrl(pin.thumbnailUrl)}
                />
              </View>
            ))}

          {/*
            받는 동안 그 자리에서 도는 표시. 색은 홈 계열 로딩과 같은 진한 라임이다
            (`colors.limeText` — 순수 라임은 밝은 바닥에서 보이지 않는다).

            핀 상세의 영상은 회색 판에 빛줄기가 흐르는 `MediaLoadingSweep`을 쓴다. 그쪽은 화면을
            채우는 큰 프레임이라 판이 어울리지만, 152×128 칸에서는 빛줄기가 스쳐 지나가 무엇을
            기다리는지 읽히지 않는다. 지도가 타일을 기다릴 때와 같은 표시로 둔다.
          */}
          {waiting && (
            <View pointerEvents="none" style={s.thumbnailBusy}>
              <ActivityIndicator size="small" color={colors.limeText} />
            </View>
          )}
        </View>

        <View style={s.copy}>
          {/*
            **비어 있어도 자리는 지키고, 무엇이 없는지 대신 한 마디를 둔다.**

            메모와 태그는 등록할 때 선택 입력이라 없는 핀이 흔하다. 예전에는 줄표(—)만 두었는데
            눈으로만 뜻이 통하고 읽을 것이 없었다. `내용 없음`처럼 없다는 사실을 적는 것도
            한 카드에 두 번 쌓여 시끄러웠다(팀 의견).

            지금은 **그 카드에서 볼 것이 무엇인지** 적는다 — 남긴 글이 없으면 볼 것은 영상이다.
            태그 자리는 칩 모양을 지켜 "태그가 들어올 자리"임을 보이고 `#`만 둔다.
          */}
          {memo.length > 0 ? (
            <Text numberOfLines={MEMO_MAX_LINES} ellipsizeMode="tail" style={s.memo}>
              {memo}
            </Text>
          ) : (
            <Text numberOfLines={MEMO_MAX_LINES} style={s.memoEmpty}>
              {EMPTY_MEMO_MESSAGE}
            </Text>
          )}

          {/*
            태그 칩 줄. **없으면 아무것도 두지 않고 자리만 비운다.**

            예전에는 빈 칩에 `#` 하나를 넣어 "태그가 들어올 자리"임을 보였는데, 달지 않은 태그가
            달린 것처럼 읽혔다(2026-08-07 의견). 없는 것은 없는 대로 두는 편이 맞다.

            줄 자체는 그대로 그린다 — `minHeight`가 높이를 지켜, 태그가 있든 없든 카드 안의
            리듬과 썸네일 아랫변에 맞춘 정렬이 달라지지 않는다.
          */}
          <View style={s.tags}>
            {pin.tags.map((tag) => (
              <View key={tag} style={s.tag}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={s.tagText}>
                  #{tag}
                </Text>
              </View>
            ))}
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
    padding: CARD_PADDING,
    borderRadius: radius.hero,
    /*
      테두리 자리를 고르지 않았을 때도 비워 둔다(투명). 고를 때만 주면 그 카드가 3px 높아져
      한 장씩 넘기는 칸에서 아래가 잘린다 — 홈의 장소 카드와 같은 이유다.
    */
    borderWidth: CARD_BORDER,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  /** 지도 중앙에 정렬된 핀. 홈의 선택된 장소 카드와 같은 양식이다. */
  cardSelected: { borderColor: colors.lime },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  authorCopy: { flex: 1 },
  /** 닉네임과 `내 글` 표시가 한 줄에 선다. 이름이 길면 이름만 줄어든다. */
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  authorName: { ...type.label, flexShrink: 1, fontWeight: '600', color: colors.dark },
  /**
   * 내 글 표시. 닉네임 옆에 `(나)`만 둔다.
   *
   * 한때 연두색 상자에 `내 글`을 담았는데 **눈에 너무 세게 걸렸다**(2026-08-07 팀 논의). 이건
   * 시연에서 설명을 줄이려는 보조 표시라, 이름을 읽는 흐름을 끊지 않고 곁들여 읽히면 된다.
   *
   * 그래서 상자를 걷고 괄호만 남긴다. 괄호는 그 자체로 "덧붙인 말"이라는 뜻이 있어 상자 없이도
   * 닉네임과 구분된다. 색은 이름(`dark`)보다 확실히 물러난 연회색이다.
   */
  mineMark: { ...type.caption, color: colors.gray400 },
  time: { ...type.caption, color: colors.gray400 },
  // 높이를 고정해 카드마다 키가 같아진다. 근거는 `THUMBNAIL_HEIGHT` 주석에 있다.
  body: {
    height: THUMBNAIL_HEIGHT,
    flexDirection: 'row',
    gap: spacing.x3,
    marginTop: spacing.x3,
  },
  /**
   * 썸네일 칸. 층(색 자리·그림·기다리는 표시)을 겹쳐 담으므로 **자르고 가운데를 잡는다.**
   *
   * 크기를 고정한다 — 이 칸의 높이가 카드 높이를 정하고(`THUMBNAIL_HEIGHT`), 그 값이 홈 시트의
   * 단계 높이까지 정한다(`PLACE_PIN_CARD_HEIGHT`).
   */
  thumbnail: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 칸을 가득 채우는 층. 색 자리와 선명한 그림이 쓴다. */
  thumbnailFill: StyleSheet.absoluteFillObject,
  /** 열람 전 그림을 흐리게 하는 층. 번진 가장자리는 감싼 칸이 자른다. */
  thumbnailBlur: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    filter: [{ blur: PREVIEW_BLUR_RADIUS }],
  },
  /**
   * 흐린 그림을 담는 자리. **비율로 키운다.**
   *
   * 반경만큼 넉넉히 넘치게 두어 옅은 가장자리를 칸 밖으로 밀어낸다. 백분율이라 칸 크기를 바꿔도
   * 따라온다 — 근거는 위 `PREVIEW_BLUR_OVERSCAN` 설명에 있다.
   */
  thumbnailOverscan: {
    width: `${PREVIEW_BLUR_OVERSCAN * 100}%`,
    height: `${PREVIEW_BLUR_OVERSCAN * 100}%`,
  },
  /** 기다리는 표시를 놓는 층. 그림 위에 오되 손가락은 카드가 받는다. */
  thumbnailBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  memo: { ...type.small, color: colors.gray600 },
  /**
   * 메모 자리를 대신 채우는 한 마디.
   *
   * 실제 메모보다 옅게 둔다 — 작성자가 쓴 글이 아니라 화면이 놓은 안내라, 같은 색이면 남의 말을
   * 작성자 것으로 읽게 된다.
   *
   * `gray400` → `gray300`으로 물렸다(2026-08-07 의견, 두 번). 흰 카드 위에서 1.5:1이라 읽어야
   * 하는 글의 기준에는 한참 못 미치지만, 지나쳐도 되는 안내라 그 자리가 맞다. 더 진하게
   * 되돌리려면 `gray400`.
   *
   * **기울인다.** 작성자가 쓴 글이 아니라 화면이 대신 놓은 말이라는 것이 색만으로는 덜 드러난다.
   * 이 앱은 별도 글꼴을 싣지 않아 시스템 글꼴을 쓰는데, 한글 글꼴에는 이탤릭 자형이 없어
   * **안드로이드가 기울여 그린다**(합성 오블리크). 짧은 두 줄이라 그 정도로 충분하다 —
   * 실기기에서 거칠어 보이면 이 한 줄만 빼면 된다.
   */
  memoEmpty: { ...type.small, color: colors.gray300, fontStyle: 'italic' },
  /**
   * 태그 칩 줄. **썸네일 아랫변에 맞춰 바닥에 붙인다.**
   *
   * `marginTop: 'auto'`가 남는 높이를 위로 몰아 이 줄을 칸 맨 아래로 내린다. 옆 칸의 높이는
   * 썸네일 높이로 고정돼 있으므로(`body`), 결과적으로 태그 줄의 아랫변이 썸네일 아랫변과 같은
   * 선에 놓인다 — 메모가 한 줄이든 네 줄이든 카드마다 같은 자리다.
   *
   * 태그가 없을 때도 이 줄의 높이는 그대로 남아, 카드마다 썸네일 아랫변이 같은 선에 놓인다.
   */
  tags: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x1,
    marginTop: 'auto',
    overflow: 'hidden',
  },
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
