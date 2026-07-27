import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

export function ScreenHeader({ title, back, right, onBack }: { title: string; back?: boolean; right?: ReactNode; onBack?: () => void }) {
  return <View style={s.header}>{back ? <Pressable accessibilityLabel="뒤로 가기" onPress={onBack} style={s.iconBtn}><Ionicons name="chevron-back" size={24} color={colors.dark} /></Pressable> : <View style={s.headerGap} />}<Text style={s.headerTitle}>{title}</Text><View style={s.headerRight}>{right}</View></View>;
}
export function Button({ label, onPress, variant = 'primary', disabled, icon }: { label: string; onPress?: () => void; variant?: 'primary' | 'dark' | 'ghost' | 'danger'; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const bg = variant === 'primary' ? colors.lime : variant === 'dark' ? colors.dark : variant === 'danger' ? '#FFF0F1' : colors.gray100;
  const fg = variant === 'dark' ? colors.white : variant === 'danger' ? colors.danger : colors.dark;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? .45 : pressed ? .76 : 1 }]}>{icon && <Ionicons name={icon} size={20} color={fg} />}<Text style={[s.buttonText, { color: fg }]}>{label}</Text></Pressable>;
}
export function Chip({ label, selected, onPress, dot }: { label: string; selected?: boolean; onPress?: () => void; dot?: string }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}>{dot && <View style={[s.dot, { backgroundColor: dot }]} />}<Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text></Pressable>;
}
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) { return <View style={[s.card, style]}>{children}</View>; }
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable onPress={onAction}><Text style={s.sectionAction}>{action}</Text></Pressable>}</View>; }
export function SearchField({ placeholder = '장소명이나 태그를 검색해보세요', onPress, value, onChangeText }: { placeholder?: string; onPress?: () => void; value?: string; onChangeText?: (v: string) => void }) {
  return <Pressable onPress={onPress} style={s.search}><Ionicons name="search" size={20} color={colors.gray600} />{onChangeText ? <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.gray400} style={s.searchInput} /> : <Text style={s.searchPlaceholder}>{placeholder}</Text>}</Pressable>;
}
export function CrowdBadge({ label, color }: { label: string; color: string }) { return <View style={s.badge}><View style={[s.dot, { backgroundColor: color }]} /><Text style={s.badgeText}>{label}</Text></View>; }

const s = StyleSheet.create({
  header: { height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerGap: { width: layout.minTouch }, headerRight: { minWidth: layout.minTouch, alignItems: 'flex-end' }, iconBtn: { width: layout.minTouch, height: layout.minTouch, justifyContent: 'center' }, headerTitle: { ...type.title, color: colors.dark },
  button: { minHeight: layout.buttonHeight, borderRadius: radius.lg, flexDirection: 'row', gap: spacing.x2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.x5 }, buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  chip: { minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 }, chipSelected: { backgroundColor: colors.dark, borderColor: colors.dark }, chipText: { ...type.label, color: colors.gray600 }, chipTextSelected: { color: colors.white }, dot: { width: 8, height: 8, borderRadius: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: layout.cardPadding, borderWidth: 1, borderColor: colors.gray200 }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.x8, marginBottom: spacing.x3 }, sectionTitle: { ...type.h3, color: colors.dark }, sectionAction: { ...type.label, color: colors.gray600 },
  search: { height: layout.searchHeight, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, paddingHorizontal: spacing.x4 }, searchPlaceholder: { ...type.body, color: colors.gray400 }, searchInput: { flex: 1, ...type.body, color: colors.dark, padding: 0 }, badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 }, badgeText: { ...type.label, color: colors.dark },
});
