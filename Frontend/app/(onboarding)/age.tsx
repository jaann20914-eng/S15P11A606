import { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ScreenHeader } from '@/components/common/ui';
import { PreferenceCard } from '@/features/onboarding/components/PreferenceCard';
import { preferenceCategoryImages } from '@/features/onboarding/preferenceAssets';
import { useOnboardingSubmit } from '@/features/onboarding/hooks/useOnboardingSubmit';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';
import {
  MAX_PREFERENCES,
  MIN_PREFERENCES,
  preferenceCategories,
  preferenceCategoryLabel,
} from '@/constants/categories';
import type { PreferenceCategoryCode } from '@/constants/categories';
import { NICKNAME_MIN_LENGTH, ageGroups, genders } from '@/constants/onboarding';
import { colors, radius, spacing, type } from '@/constants/theme';
import type { AgeGroup, Gender } from '@/types/onboarding';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

export default function Onboarding() {
  const screenGutter = useResponsivePadding();
  const [step, setStep] = useState(1);
  // 화면 상태에 서버 enum을 그대로 담는다. 전송 직전에 한글 문구를 변환하지 않는다.
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('TWENTIES');
  const [gender, setGender] = useState<Gender>('FEMALE');
  const [nickname, setNickname] = useState('');
  const [checked, setChecked] = useState(false);
  // 서버로 보내는 값은 code다(`preferredCategories`). 라벨은 표시에만 쓴다.
  const [selected, setSelected] = useState<PreferenceCategoryCode[]>(['PARK']);

  // 서버가 닉네임 중복을 알려주면 입력 단계로 되돌린다. 중복확인 API는 아직 없어
  // 이 경로가 유일한 검증 지점이다.
  const returnToNickname = useCallback(() => {
    setChecked(false);
    setStep(2);
  }, []);

  const onboarding = useOnboardingSubmit(returnToNickname);

  const next = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    onboarding.submit({ ageGroup, gender, nickname: nickname.trim(), preferredCategories: selected });
  };

  /** 이미 고른 것은 항상 해제할 수 있고, 상한에 닿았을 때만 추가를 막는다. */
  const togglePreference = (code: PreferenceCategoryCode) =>
    setSelected((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);
      return current.length < MAX_PREFERENCES ? [...current, code] : current;
    });

  const checkNickname = () => {
    if (nickname.trim().length >= NICKNAME_MIN_LENGTH) setChecked(true);
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
                {ageGroups.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: ageGroup === value }}
                    onPress={() => setAgeGroup(value)}
                    style={[s.ageItem, ageGroup === value && s.ageItemSelected]}
                  >
                    <Text style={[s.ageText, ageGroup === value && s.ageTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.sectionLabel}>성별</Text>
              <View style={s.genderGroup}>
                {genders.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: gender === value }}
                    onPress={() => setGender(value)}
                    style={[s.genderItem, gender === value && s.genderItemSelected]}
                  >
                    <Text style={[s.genderText, gender === value && s.genderTextSelected]}>{label}</Text>
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

              {/*
                고른 순서가 곧 순위다. 아직 아무것도 안 골랐으면 규칙을 알려주고,
                고르는 중에는 지금까지의 순위를 그대로 되짚어 준다.
              */}
              <Text style={s.rankHint}>
                {selected.length === 0
                  ? `먼저 고른 순서대로 1~${MAX_PREFERENCES}순위가 정해져요`
                  : selected
                      .map((code, index) => `${index + 1}순위 ${preferenceCategoryLabel(code)}`)
                      .join('   ')}
              </Text>

              {/*
                와이어프레임은 이 자리에 큰 일러스트 대신 카테고리 카드 6개를 둔다.
                카드마다 3D 에셋이 들어가므로 대표 일러스트가 따로 필요하지 않다.
              */}
              <View style={s.preferenceGrid}>
                {preferenceCategories.map(({ code, label }) => {
                  const isSelected = selected.includes(code);
                  return (
                    <View key={code} style={s.preferenceCell}>
                      <PreferenceCard
                        label={label}
                        selected={isSelected}
                        image={preferenceCategoryImages[code]}
                        disabled={!isSelected && selected.length >= MAX_PREFERENCES}
                        onPress={() => togglePreference(code)}
                      />
                    </View>
                  );
                })}
              </View>

              {/*
                와이어프레임에는 개수 안내가 없지만 상한이 정해져 있다.
                안내가 없으면 네 번째 탭이 무반응으로만 보이므로 상한에 닿을 때만 알린다.
              */}
              {selected.length >= MAX_PREFERENCES && (
                <Text style={s.limitNotice}>최대 {MAX_PREFERENCES}개까지 선택할 수 있어요</Text>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          {/* 가입 실패 문구. 스크롤 위치와 무관하게 보이도록 버튼 바로 위에 둔다. */}
          {onboarding.error && (
            <Text accessibilityRole="alert" style={s.submitError}>
              {onboarding.error}
            </Text>
          )}
          <Button
            label={step === 3 ? (onboarding.busy ? '가입 중이에요…' : '와글와글 시작하기') : '다음'}
            disabled={
              onboarding.busy || (step === 2 && !checked) || (step === 3 && selected.length < MIN_PREFERENCES)
            }
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
  /**
   * 3열 2행 그리드.
   *
   * 셀 폭을 퍼센트로 주고 `space-between`으로 간격을 만든다. RN에서 퍼센트 폭은
   * `gap`을 계산에 넣지 않아 둘을 같이 쓰면 3열이 안 맞는다. 세로 간격만 `rowGap`으로 준다.
   */
  /**
   * 순위 안내. 격자 바로 위에 작게 둔다.
   *
   * 최장 조합("1순위 전시, 문화공간 …" 3개)이 360dp에서 268px로 컨테이너 318px에 들어가
   * 한 줄로 유지된다. 잘리면 뒤쪽 순위가 사라지므로 `numberOfLines`로 막지 않고,
   * 라벨이 길어지면 줄바꿈되며 격자가 밀리도록 둔다.
   */
  rankHint: {
    ...type.caption,
    color: colors.gray600,
    marginTop: spacing.x6,
    marginBottom: spacing.x2,
  },
  preferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.x3,
  },
  preferenceCell: { width: '31.5%' },
  limitNotice: { ...type.small, color: colors.gray600, marginTop: spacing.x3, textAlign: 'center' },
  submitError: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.x2,
  },
  footer: {
    paddingTop: spacing.x3,
    paddingBottom: spacing.x4,
    backgroundColor: colors.white,
  },
});
