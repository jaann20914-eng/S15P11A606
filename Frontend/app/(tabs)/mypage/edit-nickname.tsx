import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

const navItems = [
  { label: '홈', icon: 'map-outline', path: '/(tabs)/home', capture: false },
  { label: '추천', icon: 'sparkles-outline', path: '/(tabs)/recommend', capture: false },
  { label: '제보', icon: 'add', path: '/(tabs)/write', capture: true },
  { label: '채팅', icon: 'chatbubbles-outline', path: '/(tabs)/chat/sent', capture: false },
  { label: '마이', icon: 'person', path: '/(tabs)/mypage', capture: false },
] as const;

export default function Profile() {
  const [nickname, setNickname] = useState('');
  const [checked, setChecked] = useState(false);
  const canCheck = nickname.trim().length >= 2;

  const changeNickname = (value: string) => {
    setNickname(value);
    setChecked(false);
  };

  const save = () => {
    if (!checked) return;
    router.replace('/(tabs)/mypage');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gray400}/>
          </Pressable>
          <Text style={s.headerTitle}>나의 정보</Text>
          <View style={s.headerButton}/>
        </View>

        <View style={s.content}>
          <Text style={s.title}>닉네임 수정</Text>
          <Text style={s.description}>변경 전 중복 확인이 필요해요.</Text>

          <View style={[s.inputShell, checked && s.inputShellChecked]}>
            <TextInput
              value={nickname}
              onChangeText={changeNickname}
              maxLength={12}
              autoCapitalize="none"
              placeholder="2~12자를 입력해주세요"
              placeholderTextColor={colors.gray400}
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!canCheck}
              onPress={() => setChecked(true)}
              style={[s.checkButton, !canCheck && s.checkDisabled, checked && s.checkedButton]}
            >
              {checked && <Ionicons name="checkmark" size={14} color={colors.gray600}/>}
              <Text style={[s.checkText, !canCheck && s.checkTextDisabled]}>{checked ? '확인됨' : '중복확인'}</Text>
            </Pressable>
          </View>

          <View style={s.helperRow}>
            <Text style={[s.helper, checked && s.success]}>{checked ? '사용할 수 있는 닉네임이에요.' : '한글, 영문, 숫자를 사용할 수 있어요.'}</Text>
            <Text style={s.count}>{nickname.length} / 12</Text>
          </View>

          <Pressable accessibilityRole="button" disabled={!checked} onPress={save} style={[s.saveButton, !checked && s.saveDisabled]}>
            <Text style={[s.saveText, !checked && s.saveTextDisabled]}>변경 저장</Text>
          </Pressable>
        </View>

        <View style={s.bottomNav}>
          {navItems.map(item => (
            <Pressable key={item.label} onPress={() => router.replace(item.path)} style={s.navItem}>
              <View style={item.capture && s.captureButton}>
                <Ionicons name={item.icon} size={item.capture ? 30 : 21} color={item.label === '마이' ? colors.dark : item.capture ? colors.white : colors.gray400}/>
              </View>
              <Text style={[s.navLabel, item.label === '마이' && s.navActive, item.capture && s.captureLabel]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.label, fontWeight: '600', color: colors.gray600 },
  content: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.x10 },
  title: { ...type.h2, color: colors.dark },
  description: { ...type.body, color: colors.gray600, marginTop: spacing.x1 },
  inputShell: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.x12,
    paddingLeft: spacing.x4,
    paddingRight: spacing.x1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  inputShellChecked: { borderColor: colors.lime },
  input: { flex: 1, height: '100%', padding: 0, paddingRight: spacing.x2, ...type.body, color: colors.dark },
  checkButton: {
    minWidth: 88,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingHorizontal: spacing.x3,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
  },
  checkDisabled: { backgroundColor: colors.gray100 },
  checkedButton: { backgroundColor: colors.limeSoft },
  checkText: { ...type.label, fontWeight: '600', color: colors.dark },
  checkTextDisabled: { color: colors.gray400 },
  helperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.x2 },
  helper: { ...type.caption, color: colors.gray600 },
  success: { color: colors.success, fontWeight: '500' },
  count: { ...type.caption, color: colors.gray400 },
  saveButton: {
    height: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: colors.lime,
  },
  saveDisabled: { backgroundColor: '#E3F58A' },
  saveText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.dark },
  saveTextDisabled: { color: colors.gray400 },
  bottomNav: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  navItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500', color: colors.gray400, marginTop: spacing.x1 },
  navActive: { color: colors.dark, fontWeight: '600' },
  captureButton: {
    width: 54,
    height: 54,
    marginTop: -25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: '#D9ED76',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: .18,
    shadowRadius: 8,
    elevation: 7,
  },
  captureLabel: { marginTop: spacing.x2 },
});
