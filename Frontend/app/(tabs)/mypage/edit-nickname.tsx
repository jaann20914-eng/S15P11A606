import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { colors } from '@/constants/theme';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { NicknameField } from '@/features/mypage/components/NicknameField';
import { useNicknameSave } from '@/features/mypage/hooks/useNicknameSave';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 닉네임 수정.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function EditNicknameScreen() {
  const edit = useNicknameCheck();
  const saving = useNicknameSave();

  /** 저장을 누를 수 있는지. 중복 확인을 통과했고 저장 중이 아니어야 한다. */
  const canSave = edit.checked && !saving.saving;

  const save = async () => {
    if (!canSave) return;

    const saved = await saving.save(edit.nickname);
    if (saved === null) {
      // 서버가 거절했다. "확인됨"이 더는 맞지 않으므로 확인을 풀고 화면에 남는다.
      edit.invalidate(saving.error ?? '닉네임을 저장하지 못했어요.');
      return;
    }

    router.replace('/(tabs)/mypage');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <MypageHeader title="나의 정보" />

        <View style={s.nicknameContent}>
          <Text style={s.nicknameTitle}>닉네임 수정</Text>
          <Text style={s.nicknameDescription}>변경 전 중복 확인이 필요해요.</Text>

          <NicknameField edit={edit} />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: saving.saving }}
            disabled={!canSave}
            onPress={save}
            style={[s.saveButton, !canSave && s.saveDisabled]}
          >
            {saving.saving ? (
              <ActivityIndicator color={colors.gray600} />
            ) : (
              <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>변경 저장</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
