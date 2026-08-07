import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 검색 화면의 목록 한 줄.
 *
 * 시안의 검색 컴포넌트 셋(최근 검색 기록 · 검색(장소핀 타겟팅) · 검색(자동완성))이 같은 뼈대를
 * 쓴다 — 왼쪽 원형 아이콘, 가운데 글자, 오른쪽 보조 영역. 세 벌로 나눠 두면 간격과 구분선이
 * 서로 어긋나므로 한 줄 컴포넌트에 무엇을 채울지만 다르게 준다.
 */

export interface SearchRowProps {
  /** 왼쪽 원형 아이콘. 장소는 핀, 태그·키워드는 돋보기다. */
  icon: 'place' | 'keyword';
  onPress: () => void;
  accessibilityLabel: string;
  /** 가운데에 들어갈 것. 글자를 강조해야 해서 문자열 대신 노드로 받는다. */
  children: React.ReactNode;
  /** 오른쪽 끝. 날짜나 입력창 채우기 버튼이 온다. */
  trailing?: React.ReactNode;
  /** 확정 요청이 도는 줄. 오른쪽 영역을 표시로 바꾼다. */
  pending?: boolean;
}

export function SearchRow({
  icon,
  onPress,
  accessibilityLabel,
  children,
  trailing,
  pending = false,
}: SearchRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={s.row}
    >
      <View style={s.iconCircle}>
        <Ionicons name={icon === 'place' ? 'location' : 'search'} size={16} color={colors.gray400} />
      </View>

      <View style={s.copy}>{children}</View>

      {/* 기다리는 줄에는 표시를 준다. 없으면 눌렸는지 알 수 없다. */}
      {pending ? <ActivityIndicator size="small" color={colors.limeText} /> : trailing}
    </Pressable>
  );
}

/**
 * 입력창에 검색어를 채워 넣는 버튼. 시안 `검색(자동완성)`의 오른쪽 화살표다.
 *
 * 줄 전체를 누르면 곧바로 검색되므로, 고르지 않고 **다듬어서 다시 검색**하고 싶을 때 쓴다.
 */
export function FillButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={12} onPress={onPress}>
      <Ionicons name="arrow-up-outline" size={18} color={colors.gray400} />
    </Pressable>
  );
}

export interface HighlightedTextProps {
  text: string;
  query: string;
  /**
   * 뒤에 흐리게 붙일 안내말. 없으면 붙이지 않는다.
   *
   * 태그 줄이 `#데이트 태그로 검색`처럼 읽히게 하는 데 쓴다. 한 `Text` 안에 이어 붙이므로
   * 태그가 길어 줄바꿈될 때 안내말이 따로 떨어지지 않는다.
   */
  suffix?: string;
}

/** 검색어와 겹치는 부분을 파랗게 남긴다. 어디가 맞아 떨어졌는지 바로 보인다. */
export function HighlightedText({ text, query, suffix }: HighlightedTextProps) {
  const start = query.length > 0 ? text.indexOf(query) : -1;
  const tail = suffix === undefined ? null : <Text style={s.suffix}>{suffix}</Text>;

  if (start < 0) {
    return (
      <Text style={s.body}>
        {text}
        {tail}
      </Text>
    );
  }

  return (
    <Text style={s.body}>
      {text.slice(0, start)}
      <Text style={s.match}>{text.slice(start, start + query.length)}</Text>
      {text.slice(start + query.length)}
      {tail}
    </Text>
  );
}

const s = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingVertical: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F5',
  },
  copy: { flex: 1, minWidth: 0 },
  body: { ...type.label, color: colors.dark },
  match: { color: '#2F80ED', fontWeight: '600' },
  /** 안내말(`태그로 검색`). 태그 이름보다 흐려서 무엇이 태그인지 갈린다. */
  suffix: { color: colors.gray600, fontWeight: '400' },
});
