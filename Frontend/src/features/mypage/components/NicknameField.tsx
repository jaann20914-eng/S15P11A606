import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { NicknameCheck } from '@/hooks/useNicknameCheck';
import { NICKNAME_MAX_LENGTH } from '@/constants/onboarding';
import { mypageStyles as s } from '../styles';

export interface NicknameFieldProps {
  edit: NicknameCheck;
}

/** 닉네임 입력과 중복 확인. */
export function NicknameField({ edit }: NicknameFieldProps) {
  return (
    <>
      <View style={[s.inputShell, edit.checked && s.inputShellChecked]}>
        <TextInput
          value={edit.nickname}
          onChangeText={edit.change}
          maxLength={NICKNAME_MAX_LENGTH}
          autoCapitalize="none"
          placeholder={`2~${NICKNAME_MAX_LENGTH}자를 입력해주세요`}
          placeholderTextColor={colors.gray400}
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!edit.canCheck}
          onPress={edit.check}
          style={[s.checkButton, !edit.canCheck && s.checkDisabled, edit.checked && s.checkedButton]}
        >
          {edit.checking ? (
            <ActivityIndicator color={colors.gray600} />
          ) : (
            <>
              {edit.checked && <Ionicons name="checkmark" size={14} color={colors.gray600} />}
              <Text style={[s.checkText, !edit.canCheck && s.checkTextDisabled]}>
                {edit.checked ? '확인됨' : '중복확인'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={s.helperRow}>
        <Text style={[s.helper, edit.checked && s.helperSuccess, edit.error !== null && s.helperError]}>
          {edit.error ??
            (edit.checked ? '사용할 수 있는 닉네임이에요.' : '한글, 영문, 숫자를 사용할 수 있어요.')}
        </Text>
        <Text style={s.count}>
          {edit.length} / {NICKNAME_MAX_LENGTH}
        </Text>
      </View>
    </>
  );
}
