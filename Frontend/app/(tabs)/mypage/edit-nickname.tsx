import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';

import { NoticeModal, useNotice } from '@/components/common';
import { MAX_PREFERENCES } from '@/constants/categories';
import { colors, layout, spacing } from '@/constants/theme';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { MypageHeader } from '@/features/mypage/components/MypageHeader';
import { NicknameField } from '@/features/mypage/components/NicknameField';
import { PreferenceEditField } from '@/features/mypage/components/PreferenceEditField';
import { useMypageSummary } from '@/features/mypage/hooks/useMypageSummary';
import { useProfileEdit } from '@/features/mypage/hooks/useProfileEdit';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { mypageStyles as s } from '@/features/mypage/styles';

/** 사라짐 그라데이션. 안드로이드에서 `transparent`는 검은색이 섞여 회색 띠가 생긴다. */
const FADE_TRANSPARENT = 'rgba(255,255,255,0)';
const FADE_NEAR_WHITE = 'rgba(255,255,255,0.96)';
const FADE_STOPS = [0, 0.55, 1] as const;

/** 아래 버튼이 차지하는 높이(버튼 + 아래 여백). 스크롤 여백과 사라짐 위치가 이 값을 쓴다. */
const BUTTON_AREA_HEIGHT = layout.buttonHeight + spacing.x4;

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
  const { profile, loading, reload } = useMypageSummary();

  /**
   * 화면을 떠나면 고치던 것을 버린다.
   *
   * 저장을 누르지 않고 탭을 옮기거나 뒤로 가면 그 입력은 없던 일이다. 다시 들어왔을 때
   * 남아 있으면 저장된 것으로 읽히는데 서버에는 반영되지 않은 값이다.
   *
   * 초점을 다시 받을 때 **폼을 통째로 새로 만든다**(key). 입력값·중복 확인·고른 카드가
   * 흩어져 있어 하나씩 되돌리면 빠뜨리기 쉽고, 새로 만들면 카테고리도 서버에서 다시 받아
   * 지금 값으로 시작한다.
   */
  const focused = useIsFocused();
  const [formKey, setFormKey] = useState(0);
  const wasFocused = useRef(focused);

  useEffect(() => {
    if (focused && !wasFocused.current) setFormKey((key) => key + 1);
    wasFocused.current = focused;
  }, [focused]);

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
          <ProfileEditor key={formKey} current={profile?.nickname ?? ''} onSaved={reload} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** 지금 값을 채워 넣은 수정 폼. */
function ProfileEditor({ current, onSaved }: { current: string; onSaved: () => void }) {
  const edit = useNicknameCheck(current);
  const profileEdit = useProfileEdit();
  const { notice, showNotice, confirmNotice } = useNotice();

  /**
   * 고치는 중인지.
   *
   * 들어오면 지금 값을 **보여주기만** 한다. 이 화면은 확인하러 들어오는 일이 더 잦은데,
   * 처음부터 입력칸이 열려 있으면 실수로 건드린 값이 저장된 것처럼 보인다. "수정하기"를
   * 누른 뒤에야 입력과 카드가 열리고, 버튼도 "변경 저장"으로 바뀐다.
   */
  const [editing, setEditing] = useState(false);

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
  /**
   * 마지막으로 저장된 닉네임.
   *
   * 처음에는 불러온 값이고, 저장에 성공하면 서버가 돌려준 값으로 바뀐다. 바뀌었는지 판단하는
   * 기준이라 갱신하지 않으면 저장 직후에도 "바꾼 상태"로 남아 중복 확인을 다시 요구한다.
   */
  const [savedNickname, setSavedNickname] = useState(current);

  const nicknameChanged = edit.nickname.trim() !== savedNickname;
  /**
   * 닉네임을 바꿨는데 아직 쓸 수 있다고 확인되지 않은 상태.
   *
   * 확인을 통과해야만(`checked`) 저장할 수 있다 — 중복이면 확인이 풀린 채로 남으므로 여기서
   * 걸린다. 바꾸지 않았으면 확인을 요구하지 않는다: 중복 확인 API는 **쓰고 있는 이름도
   * 이미 있는 이름으로** 답해서(`existsByNickname`), 관심 장소만 고치려는 사람이 자기
   * 이름에 막히게 된다.
   */
  const needsNicknameCheck = nicknameChanged && !edit.checked;

  const canSave =
    !needsNicknameCheck && profileEdit.categories.length > 0 && !profileEdit.saving && !profileEdit.loading;

  /** 읽기 상태의 "수정하기"는 늘 누를 수 있다. 고치는 중에만 저장 조건을 본다. */
  const buttonEnabled = editing ? canSave : !profileEdit.loading;

  const save = async () => {
    if (!canSave) return;

    const saved = await profileEdit.save(edit.nickname.trim());

    if (saved === null) {
      // 서버가 거절했다. 닉네임 문제라면 "확인됨"이 더는 맞지 않으므로 확인을 푼다.
      if (nicknameChanged) edit.invalidate(profileEdit.error ?? '닉네임을 저장하지 못했어요.');
      return;
    }

    /*
      저장하고도 이 화면에 머문다. 바꾼 것이 반영된 모습을 그 자리에서 확인하고, 이어서 더
      고칠 수도 있어야 한다 — 마이페이지로 돌려보내면 무엇이 저장됐는지 다시 들어와 봐야 한다.

      읽기 상태로 돌아가고, 저장된 값을 기준으로 삼는다. 카테고리는 스토어가 서버 응답으로
      이미 갈아 끼웠고(`useProfileEdit`), 마이페이지 요약도 다시 받아 둔다 — 돌아갔을 때
      옛 닉네임이 남아 있으면 저장이 안 된 것으로 읽힌다.
    */
    setSavedNickname(saved);
    setEditing(false);
    onSaved();
  };

  /*
    고른 카테고리를 받기 전에는 폼을 그리지 않는다.

    빈 채로 먼저 그리면 카드가 연한 색으로 떴다가 값이 도착하며 초록으로 바뀌는 과정이 그대로
    보인다 — 고르지 않은 것이 잠깐 켜지는 것처럼 읽힌다. 다 받은 뒤에 한 번에 그린다.
  */
  if (profileEdit.loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.gray400} />
      </View>
    );
  }

  return (
    <View ref={contentRef} style={s.nicknameContent}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // 아래 버튼이 내용 위에 겹쳐 있어, 가리는 만큼을 스크롤 여백으로 돌려준다.
        contentContainerStyle={s.editScroll}
      >
        <Text style={s.nicknameTitle}>나의 정보</Text>

        <View style={s.sectionGap}>
          <Text style={s.editSectionTitle}>닉네임</Text>
          <Text style={s.editSectionDescription}>변경 전 중복 확인이 필요해요.</Text>
          <NicknameField edit={edit} readOnly={!editing} />
        </View>

        <PreferenceEditField
          selected={profileEdit.categories}
          readOnly={!editing}
          onToggle={profileEdit.toggleCategory}
        />
      </ScrollView>

      {/* 내용이 버튼 밑으로 들어가며 사라지도록 짧게 덧칠한다. 선 하나보다 조용하다. */}
      <LinearGradient
        pointerEvents="none"
        colors={[FADE_TRANSPARENT, FADE_NEAR_WHITE, colors.white]}
        locations={FADE_STOPS}
        style={[s.editFade, { bottom: BUTTON_AREA_HEIGHT + keyboardOverlap }]}
      />

      {/*
        왜 저장할 수 없는지 버튼 바로 위에 적는다. 잠긴 버튼만 두면 눌리지 않는 이유를
        알 수 없어 계속 누르게 된다.
      */}
      {editing && !canSave && !profileEdit.saving && (
        <Text style={s.saveBlockedHint}>
          {needsNicknameCheck
            ? '닉네임 중복 확인을 먼저 해 주세요.'
            : `관심 장소를 1~${MAX_PREFERENCES}개 골라 주세요.`}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !buttonEnabled, busy: profileEdit.saving }}
        disabled={!buttonEnabled}
        onPress={editing ? save : () => setEditing(true)}
        style={[
          s.saveButton,
          // 읽기 상태의 "수정하기"는 연한 연두다. 저장이 아니라 여는 동작이라 무게를 낮춘다.
          !editing && s.editEnterButton,
          !buttonEnabled && s.saveDisabled,
          // 겹치지 않을 때는 0이라 원래 여백(x4)이 그대로 남는다.
          { marginBottom: spacing.x4 + keyboardOverlap },
        ]}
      >
        {profileEdit.saving ? (
          <ActivityIndicator color={colors.gray600} />
        ) : (
          <Text style={[s.saveText, !buttonEnabled && s.saveTextDisabled]}>
            {editing ? '변경 저장' : '수정하기'}
          </Text>
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
