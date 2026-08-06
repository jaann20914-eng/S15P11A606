import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { NicknameCheck } from '@/hooks/useNicknameCheck';
import { NICKNAME_MAX_LENGTH } from '@/constants/onboarding';
import { mypageStyles as s } from '../styles';

export interface NicknameFieldProps {
  edit: NicknameCheck;
  /**
   * 읽기만 하는 상태인지.
   *
   * 수정하기를 누르기 전에는 지금 값을 **보여주기만** 한다. 입력과 중복 확인은 고치기로
   * 마음먹은 뒤의 일이라, 그 전에 버튼이 놓여 있으면 무엇을 눌러야 하는지 흐려진다.
   */
  readOnly?: boolean;
}

/** 닉네임 입력과 중복 확인. */
export function NicknameField({ edit, readOnly = false }: NicknameFieldProps) {
  return (
    <>
      <View style={[s.inputShell, !readOnly && edit.checked && s.inputShellChecked]}>
        <TextInput
          value={edit.nickname}
          onChangeText={edit.change}
          editable={!readOnly}
          maxLength={NICKNAME_MAX_LENGTH}
          autoCapitalize="none"
          placeholder={`2~${NICKNAME_MAX_LENGTH}자를 입력해주세요`}
          placeholderTextColor={colors.gray400}
          style={s.input}
        />
        {!readOnly && (
          <Pressable
            accessibilityRole="button"
            disabled={!edit.canCheck}
            onPress={edit.check}
            style={[s.checkButton, !edit.canCheck && s.checkDisabled, edit.checked && s.checkedButton]}
          >
            {edit.checking ? (
              <ActivityIndicator color={colors.lime} />
            ) : (
              <>
                {edit.checked && <Ionicons name="checkmark" size={14} color={colors.gray600} />}
                <Text style={[s.checkText, !edit.canCheck && s.checkTextDisabled]}>
                  {edit.checked ? '확인됨' : '중복확인'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={s.helperRow}>
        <Text
          style={[
            s.helper,
            !readOnly && edit.checked && s.helperSuccess,
            !readOnly && edit.error !== null && s.helperError,
          ]}
        >
          {/*
            읽기 상태에서는 확인 결과를 말하지 않는다 — 아직 고치기 전이라 "사용할 수 있다"도
            "이미 쓰인다"도 지금 화면과 상관이 없다. 형식 안내만 남긴다.
          */}
          {readOnly
            ? '한글, 영문, 숫자를 사용할 수 있어요.'
            : (edit.error ??
              (edit.checked
                ? edit.isOwn
                  ? '지금 쓰고 있는 닉네임이에요.'
                  : '사용할 수 있는 닉네임이에요.'
                : '한글, 영문, 숫자를 사용할 수 있어요.'))}
        </Text>
        <Text style={s.count}>
          {edit.length} / {NICKNAME_MAX_LENGTH}
        </Text>
      </View>
    </>
  );
}
