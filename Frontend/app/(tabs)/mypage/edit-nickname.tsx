import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { NoticeModal, useNotice } from '@/components/common';
import { MAX_PREFERENCES } from '@/constants/categories';
import { colors, spacing } from '@/constants/theme';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { NicknameField } from '@/features/mypage/components/NicknameField';
import { PreferenceEditField } from '@/features/mypage/components/PreferenceEditField';
import { useMypageSummary } from '@/features/mypage/hooks/useMypageSummary';
import { useProfileEdit } from '@/features/mypage/hooks/useProfileEdit';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { mypageStyles as s } from '@/features/mypage/styles';

/**
 * 나의 정보 수정 — 닉네임과 관심 장소.
 *
 * 두 가지를 **한 화면에서 한 번에** 저장한다. 서버가 하나의 트랜잭션으로 처리해 하나라도
 * 어긋나면 전부 되돌리므로(`PATCH /users/me`), 화면을 갈라 두면 절반만 저장된 것처럼 보이는
 * 상태가 생긴다.
 *
 * 이 화면은 `(tabs)` 안에 있어 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 *
 * 지금 닉네임을 알아야 입력란에 채워 넣을 수 있어 프로필을 먼저 불러온다. 값이 도착한 뒤에
 * 폼을 마운트한다 — `useNicknameCheck`의 초기값은 첫 렌더에만 쓰이므로, 빈 값으로 먼저
 * 마운트하면 나중에 도착한 닉네임이 반영되지 않는다.
 *
 * 프로필을 못 받아도 화면은 연다. 채워 넣는 것은 편의이고, 이 화면이 하는 일(중복 확인과
 * 저장)은 그 값 없이도 된다. 조회 실패로 수정 자체를 막으면 다른 API의 장애가 번지는 셈이다.
 */
export default function EditProfileScreen() {
  const { profile, loading } = useMypageSummary();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <MypageHeader title="마이페이지" />

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.gray400} />
          </View>
        ) : (
          // 닉네임을 못 받았으면 빈 입력란으로 시작한다.
          <ProfileEditor current={profile?.nickname ?? ''} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** 지금 값을 채워 넣은 수정 폼. */
function ProfileEditor({ current }: { current: string }) {
  const edit = useNicknameCheck(current);
  const profileEdit = useProfileEdit();
  const { notice, showNotice, confirmNotice } = useNotice();

  /*
    키보드가 저장 버튼을 덮지 않게 그만큼 올린다.

    입력하는 동안 버튼이 가려지면 닫았다 눌러야 한다. `KeyboardAvoidingView`는 이 앱에서
    듣지 않는다 — 화면 끝까지 그리는 방식이라 키보드가 떠도 창이 줄지 않는다(`useKeyboardOverlap`
    주석 참고). 이 영역의 아래 끝과 키보드가 겹치는 만큼을 재서 아래 여백에 더한다.
  */
  const contentRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(contentRef);

  // 저장 실패는 그 자리에서 알린다. 화면은 그대로 두어 고쳐서 다시 누를 수 있게 한다.
  useEffect(() => {
    if (profileEdit.error === null) return;

    showNotice({
      title: '저장하지 못했어요',
      message: profileEdit.error,
      onConfirm: profileEdit.dismissError,
    });
  }, [profileEdit.error, profileEdit.dismissError, showNotice]);

  /**
   * 저장할 수 있는지.
   *
   * 닉네임을 **바꿨다면** 중복 확인을 통과해야 한다. 그대로 두고 관심 장소만 고친 경우에는
   * 확인을 요구하지 않는다 — 쓰던 이름을 다시 확인하게 만들 이유가 없다.
   */
  const nicknameChanged = edit.nickname.trim() !== current;
  const canSave =
    (!nicknameChanged || edit.checked) &&
    profileEdit.categories.length > 0 &&
    !profileEdit.saving &&
    !profileEdit.loading;

  const save = async () => {
    if (!canSave) return;

    const saved = await profileEdit.save(edit.nickname.trim());

    if (saved === null) {
      // 서버가 거절했다. 닉네임 문제라면 "확인됨"이 더는 맞지 않으므로 확인을 푼다.
      if (nicknameChanged) edit.invalidate(profileEdit.error ?? '닉네임을 저장하지 못했어요.');
      return;
    }

    router.replace('/(tabs)/mypage');
  };

  return (
    <View ref={contentRef} style={s.nicknameContent}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.nicknameTitle}>나의 정보</Text>

        <View style={s.sectionGap}>
          <Text style={s.editSectionTitle}>닉네임</Text>
          <Text style={s.editSectionDescription}>변경 전 중복 확인이 필요해요.</Text>
          <NicknameField edit={edit} />
        </View>

        <PreferenceEditField selected={profileEdit.categories} onToggle={profileEdit.toggleCategory} />
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave, busy: profileEdit.saving }}
        disabled={!canSave}
        onPress={save}
        style={[
          s.saveButton,
          !canSave && s.saveDisabled,
          // 겹치지 않을 때는 0이라 원래 여백(x4)이 그대로 남는다.
          { marginBottom: spacing.x4 + keyboardOverlap },
        ]}
      >
        {profileEdit.saving ? (
          <ActivityIndicator color={colors.gray600} />
        ) : (
          <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>변경 저장</Text>
        )}
      </Pressable>

      <NoticeModal
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        onConfirm={confirmNotice}
      />
    </View>
  );
}
