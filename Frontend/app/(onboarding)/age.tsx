import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ScreenHeader } from '@/components/common/ui';
import { PreferenceCard } from '@/features/onboarding/components/PreferenceCard';
import { preferenceCategoryImages } from '@/features/onboarding/preferenceAssets';
import { useOnboardingSubmit } from '@/features/onboarding/hooks/useOnboardingSubmit';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { useResponsivePadding } from '@/hooks/useResponsivePadding';
import {
  MAX_PREFERENCES,
  MIN_PREFERENCES,
  preferenceCategories,
  preferenceCategoryLabel,
} from '@/constants/categories';
import type { PreferenceCategoryCode } from '@/constants/categories';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ageGroups,
  genders,
} from '@/constants/onboarding';
import { colors, radius, spacing, type } from '@/constants/theme';
import type { AgeGroup, Gender } from '@/types/onboarding';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

export default function Onboarding() {
  const screenGutter = useResponsivePadding();
  const [step, setStep] = useState(1);
  // 화면 상태에 서버 enum을 그대로 담는다. 전송 직전에 한글 문구를 변환하지 않는다.
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('TWENTIES');
  const [gender, setGender] = useState<Gender>('FEMALE');
  // 서버로 보내는 값은 code다(`preferredCategories`). 라벨은 표시에만 쓴다.
  const [selected, setSelected] = useState<PreferenceCategoryCode[]>(['PARK']);

  // 입력·형식 검증·중복 확인은 전부 이 훅이 맡는다. 마이페이지 닉네임 수정과 같은 훅이라
  // 규칙이 한 곳에만 있다.
  const nickname = useNicknameCheck();

  /**
   * 가입 요청에서 닉네임 중복이 났을 때 입력 단계로 되돌린다.
   *
   * 중복 확인을 통과했어도 확인과 가입 사이에 다른 사용자가 먼저 쓸 수 있다. 그때 "확인됨"은
   * 사실과 다르므로 확인을 풀고 이유를 그 자리에 남긴다.
   */
  const returnToNickname = useCallback(() => {
    nickname.invalidate('방금 다른 분이 사용했어요. 다른 닉네임을 입력해 주세요.');
    setStep(2);
  }, [nickname.invalidate]);

  const onboarding = useOnboardingSubmit(returnToNickname);

  /** 권한 대화상자를 띄우는 동안 버튼을 잠근다. 연속으로 누르면 대화상자가 겹친다. */
  const [requestingPermissions, setRequestingPermissions] = useState(false);

  /**
   * 영상핀에 필요한 권한을 미리 받는다.
   *
   * 위치·카메라·마이크가 없으면 제보를 아예 할 수 없어 가입 직후 막힌다. 촬영 화면에서
   * 처음 물으면 거절했을 때 되돌릴 곳이 없으므로 가입을 끝내기 전에 받는다.
   */
  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    // 웹은 촬영 자체를 지원하지 않아 물을 것이 없다. 물으면 거절돼 가입이 막힌다.
    if (Platform.OS === 'web') return true;

    try {
      const location = await Location.requestForegroundPermissionsAsync();
      const camera = await Camera.requestCameraPermissionsAsync();
      const microphone = await Camera.requestMicrophonePermissionsAsync();

      if (!location.granted || !camera.granted || !microphone.granted) {
        Alert.alert(
          '필수 권한이 필요해요',
          '위치, 카메라, 마이크 권한을 모두 허용해야 가입을 완료할 수 있어요.',
        );
        return false;
      }

      // 권한만으로는 부족하다. 기기의 위치 서비스가 꺼져 있으면 여기서 실패한다.
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return true;
    } catch {
      Alert.alert('권한을 확인하지 못했어요', '기기의 위치 서비스를 켜고 다시 시도해 주세요.');
      return false;
    }
  }, []);

  const next = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // 권한을 받은 뒤에 가입을 요청한다. 거절하면 요청하지 않고 화면에 남는다.
    void (async () => {
      if (requestingPermissions) return;
      setRequestingPermissions(true);
      try {
        if (!(await ensurePermissions())) return;
      } finally {
        setRequestingPermissions(false);
      }

      // 중복 확인을 통과한 값을 그대로 보낸다. 훅이 서버가 정규화한 값으로 되돌려 넣으므로
      // 여기서 다시 다듬지 않는다.
      onboarding.submit({
        ageGroup,
        gender,
        nickname: nickname.nickname,
        preferredCategories: selected,
      });
    })();
  };

  /** 이미 고른 것은 항상 해제할 수 있고, 상한에 닿았을 때만 추가를 막는다. */
  const togglePreference = (code: PreferenceCategoryCode) =>
    setSelected((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);
      return current.length < MAX_PREFERENCES ? [...current, code] : current;
    });

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.screen, { paddingHorizontal: screenGutter }]}>
        {/* 온보딩은 아래에 진행 막대가 이어져 구분선을 겹치지 않는다. */}
        <ScreenHeader
          title={`${step} / 3`}
          back={step > 1}
          onBack={() => setStep(step - 1)}
          divider={false}
        />

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
              <View style={[s.nicknameField, nickname.checked && s.nicknameFieldChecked]}>
                <TextInput
                  value={nickname.nickname}
                  onChangeText={nickname.change}
                  placeholder={`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해주세요`}
                  placeholderTextColor={colors.gray400}
                  maxLength={NICKNAME_MAX_LENGTH}
                  autoCapitalize="none"
                  returnKeyType="done"
                  style={[s.nicknameInput, webNoOutline]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!nickname.canCheck}
                  onPress={nickname.check}
                  style={({ pressed }) => [
                    s.checkButton,
                    nickname.checked && s.checkButtonChecked,
                    !nickname.canCheck && s.checkButtonDisabled,
                    pressed && s.pressed,
                  ]}
                >
                  {/* 확인 중에는 글자를 바꾸지 않고 스피너만 얹는다. 버튼 폭이 흔들리지 않는다. */}
                  {nickname.checking ? (
                    <ActivityIndicator size="small" color={colors.dark} />
                  ) : (
                    <>
                      {nickname.checked && <Ionicons name="checkmark" size={16} color={colors.dark} />}
                      <Text style={s.checkButtonText}>{nickname.checked ? '확인됨' : '중복확인'}</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <View style={s.fieldMeta}>
                {/*
                  안내 자리 하나를 형식 설명·실패 이유·성공 문구가 나눠 쓴다.
                  실패 이유가 가장 급하므로 있으면 그것부터 보여준다.
                */}
                <Text
                  accessibilityRole={nickname.error ? 'alert' : undefined}
                  style={[
                    s.helper,
                    nickname.checked && s.helperSuccess,
                    nickname.error !== null && s.helperError,
                  ]}
                >
                  {nickname.error ??
                    (nickname.checked
                      ? '사용할 수 있는 닉네임이에요.'
                      : '한글, 영문, 숫자를 사용할 수 있어요.')}
                </Text>
                <Text style={s.characterCount}>
                  {nickname.length} / {NICKNAME_MAX_LENGTH}
                </Text>
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
              onboarding.busy ||
              requestingPermissions ||
              (step === 2 && !nickname.checked) ||
              (step === 3 && selected.length < MIN_PREFERENCES)
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
  // 실패 이유는 형식 안내보다 길어 글자 수 표시를 밀어낼 수 있다. 줄바꿈으로 흡수한다.
  helper: { ...type.small, color: colors.gray600, flexShrink: 1, marginRight: spacing.x2 },
  helperSuccess: { color: colors.success, fontWeight: '500' },
  helperError: { color: colors.danger, fontWeight: '500' },
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
