import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Button, Chip, ScreenHeader } from '@/components/common/ui';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';
import { colors, radius, spacing, type } from '@/constants/theme';

const ages = ['10대', '20대', '30대', '40대', '50대', '60대', '70대+'];
const preferences = ['공원', '축제', '팝업', '맛집', '공연', '쇼핑', '관광지', '대학교'];
const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as TextStyle)
  : undefined;

export default function Onboarding() {
  const screenGutter = useResponsivePadding();
  const [step, setStep] = useState(1);
  const [age, setAge] = useState('20대');
  const [gender, setGender] = useState('여');
  const [nickname, setNickname] = useState('');
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState(['팝업', '공원']);

  const next = () => (step < 3 ? setStep(step + 1) : router.replace('/(tabs)/home'));
  const checkNickname = () => {
    if (nickname.trim().length >= 2) setChecked(true);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.screen, { paddingHorizontal: screenGutter }]}>
        <ScreenHeader title={`${step} / 3`} back={step > 1} onBack={() => setStep(step - 1)} />

        <View style={s.progressTrack}>
          <LinearGradient
            colors={['#9FD900', colors.lime, '#D8F33D']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[s.progressFill, { width: `${(step / 3) * 100}%` }]}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {step === 1 && (
            <>
              <Text style={s.title}>맞춤 장소를 위해{`\n`}조금만 알려주세요</Text>
              <Text style={s.description}>연령대와 성별은 추천 품질을 높이는 데만 사용해요.</Text>

              <View style={s.visualFrame}>
                <Image
                  source={require('../../assets/images/onboarding-demographics-transparent.png')}
                  style={s.visualImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={s.sectionLabel}>연령대</Text>
              <View style={s.ageSelector}>
                {ages.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: age === item }}
                    onPress={() => setAge(item)}
                    style={[s.ageItem, age === item && s.ageItemSelected]}
                  >
                    <Text style={[s.ageText, age === item && s.ageTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.sectionLabel}>성별</Text>
              <View style={s.genderGroup}>
                {['여', '남'].map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: gender === item }}
                    onPress={() => setGender(item)}
                    style={[s.genderItem, gender === item && s.genderItemSelected]}
                  >
                    <Text style={[s.genderText, gender === item && s.genderTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.title}>앱에서 사용할{`\n`}닉네임을 정해주세요</Text>
              <Text style={s.description}>중복 확인이 완료된 닉네임만 사용할 수 있어요.</Text>

              <View style={s.visualFrame}>
                <Image
                  source={require('../../assets/images/onboarding-nickname-transparent.png')}
                  style={s.visualImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={s.sectionLabel}>닉네임</Text>
              <View style={[s.nicknameField, checked && s.nicknameFieldChecked]}>
                <TextInput
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                    setChecked(false);
                  }}
                  placeholder="2~12자로 입력해주세요"
                  placeholderTextColor={colors.gray400}
                  maxLength={12}
                  autoCapitalize="none"
                  returnKeyType="done"
                  style={[s.nicknameInput, webNoOutline]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={nickname.trim().length < 2}
                  onPress={checkNickname}
                  style={({ pressed }) => [
                    s.checkButton,
                    checked && s.checkButtonChecked,
                    nickname.trim().length < 2 && s.checkButtonDisabled,
                    pressed && s.pressed,
                  ]}
                >
                  {checked && <Ionicons name="checkmark" size={16} color={colors.dark} />}
                  <Text style={s.checkButtonText}>{checked ? '확인됨' : '중복확인'}</Text>
                </Pressable>
              </View>
              <View style={s.fieldMeta}>
                <Text style={[s.helper, checked && s.helperSuccess]}>
                  {checked ? '사용할 수 있는 닉네임이에요.' : '한글, 영문, 숫자를 사용할 수 있어요.'}
                </Text>
                <Text style={s.characterCount}>{nickname.length} / 12</Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.title}>어떤 장소를{`\n`}자주 찾으세요?</Text>
              <Text style={s.description}>선택한 취향으로 여유로운 곳과 활기찬 곳을 나눠 추천해요.</Text>

              <View style={s.visualFrame}>
                <Image
                  source={require('../../assets/images/onboarding-preferences-transparent.png')}
                  style={s.visualImage}
                  resizeMode="contain"
                />
              </View>

              <View style={s.selectionHeader}>
                <Text style={s.helper}>최소 1개부터 최대 4개</Text>
                <Text style={s.selectionCount}>{selected.length} / 4 선택</Text>
              </View>
              <View style={s.chips}>
                {preferences.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={selected.includes(item)}
                    onPress={() =>
                      setSelected((current) =>
                        current.includes(item)
                          ? current.filter((value) => value !== item)
                          : current.length < 4
                            ? [...current, item]
                            : current,
                      )
                    }
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Button
            label={step === 3 ? '와글와글 시작하기' : '다음'}
            disabled={(step === 2 && !checked) || (step === 3 && selected.length === 0)}
            onPress={next}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  screen: { flex: 1 },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    backgroundColor: colors.gray200,
    borderRadius: radius.pill,
    marginHorizontal: 0,
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  content: { paddingTop: spacing.x6, paddingBottom: spacing.x8 },
  title: { ...type.h1, color: colors.dark },
  description: {
    ...type.body,
    color: colors.gray600,
    marginTop: spacing.x2,
    paddingRight: spacing.x1,
  },
  visualFrame: {
    height: 180,
    marginTop: spacing.x6,
    backgroundColor: 'transparent',
  },
  visualImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  sectionLabel: {
    ...type.title,
    color: colors.dark,
    marginTop: spacing.x6,
    marginBottom: spacing.x3,
  },
  ageSelector: {
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 48,
    padding: spacing.x1,
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
  },
  ageItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  ageItemSelected: {
    backgroundColor: colors.white,
    shadowColor: '#272525',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ageText: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.gray600 },
  ageTextSelected: { fontWeight: '700', color: colors.dark },
  genderGroup: {
    flexDirection: 'row',
    height: 52,
    padding: spacing.x1,
    gap: spacing.x1,
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
  },
  genderItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  genderItemSelected: { backgroundColor: colors.dark },
  genderText: { ...type.label, color: colors.gray600 },
  genderTextSelected: { color: colors.white, fontWeight: '600' },
  nicknameField: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.x4,
    paddingRight: spacing.x1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  nicknameFieldChecked: { borderColor: '#A9D000' },
  nicknameInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    paddingRight: spacing.x2,
    ...type.body,
    color: colors.dark,
  },
  checkButton: {
    minWidth: 88,
    height: 46,
    paddingHorizontal: spacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
  },
  checkButtonChecked: { minWidth: 88, backgroundColor: colors.limeSoft },
  checkButtonDisabled: { backgroundColor: colors.gray100, opacity: 1 },
  checkButtonText: { ...type.label, fontWeight: '600', color: colors.dark },
  pressed: { opacity: 0.72 },
  fieldMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.x2,
  },
  helper: { ...type.small, color: colors.gray600 },
  helperSuccess: { color: colors.success, fontWeight: '500' },
  characterCount: { ...type.caption, color: colors.gray400 },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.x5,
    marginBottom: spacing.x3,
  },
  selectionCount: { ...type.label, color: colors.dark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  footer: {
    paddingTop: spacing.x3,
    paddingBottom: spacing.x4,
    backgroundColor: colors.white,
  },
});
