import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { NicknameField } from '@/features/mypage/components/NicknameField';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 닉네임 수정.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
export default function EditNicknameScreen() {
  const edit = useNicknameCheck();

  const save = () => {
    if (!edit.checked) return;
    // 저장 API가 아직 없다. 확정되면 여기서 호출하고 성공 후에 돌아간다.
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
            disabled={!edit.checked}
            onPress={save}
            style={[s.saveButton, !edit.checked && s.saveDisabled]}
          >
            <Text style={[s.saveText, !edit.checked && s.saveTextDisabled]}>변경 저장</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
