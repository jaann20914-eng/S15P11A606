import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { recommendStyles as s } from '../styles';

/**
 * 계열별 3D 일러스트와 문구.
 *
 * 여유·활기는 찾는 것이 다르므로 비었을 때 하는 말도 달라야 한다. 한 가지 그림으로 두면
 * 토글을 바꿔도 화면이 그대로여서 무엇을 다시 찾았는지 알 수 없다.
 *
 * 영상(`chat-request-3d.mp4` 같은 것)을 쓰지 않는다. 이 자리는 화면에 들어오는 순간 보여야
 * 하는데 영상은 받아야 뜨므로, 기다리는 동안 빈 화면이 먼저 보인다. 자주 나타나는 상태라
 * 매번 움직이는 것도 피곤하다. 번들에 든 정지 이미지는 곧바로 뜨고 통신도 필요 없다.
 */
const EMPTY_BY_MODE: Record<CrowdFilter, { image: number; title: string; body: string }> = {
  relaxed: {
    image: require('../../../../assets/images/recommend-empty-relaxed.png'),
    title: '이 주변은 아직 조용해요',
    body: '여유있는 장소를 찾으려면 영상핀이 필요해요.\n지금 이곳을 처음 알려보세요!',
  },
  wagle: {
    image: require('../../../../assets/images/recommend-empty-wagle.png'),
    title: '아직 북적이는 곳이 없어요',
    body: '사람이 모이는 자리를 찾으려면 영상핀이 필요해요.\n지금 이곳의 분위기를 처음 전해보세요!',
  },
};

export interface RecommendEmptyProps {
  /** 지금 고른 계열. 그림과 문구를 고르는 데 쓴다. */
  mode: CrowdFilter;
  /** 다시 조회한다. 잠깐 자리를 비웠다가 다시 눌러 볼 수 있어야 한다. */
  onRetry: () => void;
}

/**
 * 추천할 장소가 없을 때.
 *
 * 추천은 **핀이 달린 장소**만 대상으로 한다. 그래서 주변에 아직 올라온 것이 없으면 자연히 빈
 * 목록이 온다 — 고장이 아니라 흔한 상태다. "찾지 못했어요" 한 줄만 두면 앱이 멈춘 것처럼
 * 보이므로, 여기서 할 수 있는 일을 함께 둔다.
 *
 * 문구는 없는 것을 알리기보다 **처음이 될 수 있다**는 쪽으로 쓴다. 실제로 이 상태에서 가장
 * 쓸모 있는 행동이 직접 올리는 것이다.
 */
export function RecommendEmpty({ mode, onRetry }: RecommendEmptyProps) {
  const { image, title, body } = EMPTY_BY_MODE[mode];

  return (
    <View style={s.emptyArea}>
      <Image source={image} style={s.emptyIllustration} resizeMode="contain" />

      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/write')}
        style={s.emptyPrimary}
      >
        <Text style={s.emptyPrimaryText}>영상핀 올리기</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onRetry} style={s.emptySecondary}>
        <Text style={s.emptySecondaryText}>다시 찾아보기</Text>
      </Pressable>
    </View>
  );
}
