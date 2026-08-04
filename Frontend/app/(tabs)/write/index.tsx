import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { colors, spacing } from '@/constants/theme';
import { AppTabBar, useAppTabBarHeight } from '@/components/common';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { CaptureField } from '@/features/pin-create/components/CaptureField';
import { CrowdLevelSegment } from '@/features/pin-create/components/CrowdLevelSegment';
import { DetailLocationField } from '@/features/pin-create/components/DetailLocationField';
import { MemoField } from '@/features/pin-create/components/MemoField';
import { PinCreateHeader } from '@/features/pin-create/components/PinCreateHeader';
import { PlaceEditField } from '@/features/pin-create/components/PlaceEditField';
import { PlaceField } from '@/features/pin-create/components/PlaceField';
import { PublishingOverlay } from '@/features/pin-create/components/PublishingOverlay';
import { TagField } from '@/features/pin-create/components/TagField';
import { useEditablePin } from '@/features/pin-create/hooks/useEditablePin';
import { usePinCreateForm } from '@/features/pin-create/hooks/usePinCreateForm';
import { usePinCreateMode } from '@/features/pin-create/hooks/usePinCreateMode';
import { ACTION_FADE_DROP, pinCreateStyles as s } from '@/features/pin-create/styles';
import { usePinPublishStore } from '@/store/usePinPublishStore';
import { EMPTY_PIN_DRAFT } from '@/types/pinCreate';
import type { PinDraft } from '@/types/pinCreate';

/** 사라짐 그라데이션의 시작 색. 안드로이드에서 transparent는 검은색이 섞여 회색 띠가 생긴다. */
const FADE_TRANSPARENT = 'rgba(255,255,255,0)';

/**
 * 사라짐 구간의 중간 색과 멈춤 위치.
 *
 * 투명에서 흰색으로 곧게 이으면 아래쪽 절반이 아직 반투명이라, 완전한 흰 바와 만나는 자리에
 * 단이 진다. 중간에 거의 흰색을 한 번 찍어 절반쯤에서 이미 흰색이 되게 하면 이어지는 곳이
 * 눈에 띄지 않는다.
 */
const FADE_NEAR_WHITE = 'rgba(255,255,255,0.96)';
const FADE_STOPS = [0, 0.55, 1] as const;

/** 키보드가 다 올라오기를 기다리는 시간(ms). 이보다 일찍 옮기면 줄어들기 전 높이로 계산된다. */
const KEYBOARD_SETTLE_MS = 180;

/**
 * 게시글 작성 · 수정 화면.
 *
 * `pinId` 파라미터가 붙어 들어오면 수정, 없으면 생성이다. 두 흐름이 같은 화면을 쓰고
 * 문구와 제출 대상만 갈린다.
 *
 * 등록 진행 상태는 스토어에 있어 다른 탭으로 이동해도 업로드가 끊기지 않는다.
 * 접수가 끝날 때까지 이 화면에 있었다면 등록된 핀으로 이동한다.
 */
export default function PinCreateScreen() {
  const { mode, copy } = usePinCreateMode();

  /*
    수정이면 기존 값을 먼저 불러온다. 부분 수정이라 무엇이 바뀌었는지 알아야 하고,
    그 판단 기준이 이 값이다. 생성이면 불러올 것이 없다.
  */
  const editable = useEditablePin(mode.type === 'edit' ? mode.pinId : null);
  const initialDraft = useMemo<PinDraft>(
    () => ({ ...EMPTY_PIN_DRAFT, ...(editable.initial ?? {}) }),
    [editable.initial],
  );

  const form = usePinCreateForm(editable.initial ?? undefined);

  /** 원래 등록돼 있던 장소. 수정에서 다른 장소를 찾을 기준이 된다. */
  const originPlace = initialDraft.place?.source === 'internal' ? initialDraft.place : null;

  /** 수정인데 아직 기존 값이 없는 상태. 불러오는 중이거나 실패했다. */
  const notReadyToEdit = mode.type === 'edit' && editable.initial === null;
  const [focused, setFocused] = useState(false);
  /** 아래 고정 영역이 내용 위에 겹쳐 있어, 가리는 만큼을 스크롤 여백으로 돌려준다. */
  const [actionBarHeight, setActionBarHeight] = useState(0);

  /*
    키보드가 폼을 덮는 만큼. 폼의 아래 끝과 키보드 윗변을 직접 재서 얻는다.
    탭바 높이를 손으로 빼는 계산은 키보드가 커질 때 어긋난다(`useKeyboardOverlap` 주석).
  */
  const formRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(formRef);

  /*
    수정 라우트는 탭 밖이라 하단 바를 네비게이터가 그려 주지 않는다. 작성과 같은 모양이 되도록
    상세 화면처럼 직접 그리고, 바가 차지하는 만큼 아래 여백을 올린다. 작성(탭 안)에서는 0이다.
  */
  const tabBarHeight = useAppTabBarHeight();

  /*
    아래 고정 영역을 띄울 높이. 키보드와 하단 바 중 **더 높은 쪽 하나**다.

    키보드는 하단 바를 덮고 올라온다. 둘을 더하면 버튼이 키보드보다 바 높이만큼 더 올라가
    화면 가운데에 떠 버린다.
  */
  const bottomOffset = Math.max(keyboardOverlap, mode.type === 'edit' ? tabBarHeight : 0);

  /*
    입력칸을 누르면 그 칸이 보이도록 스크롤을 맞춘다.

    키보드가 올라오면 보이는 높이가 줄어드는데, 스크롤 위치는 그대로라 아래쪽 칸은 키보드
    뒤로 들어가 무엇을 치는지 보이지 않는다. 칸이 내용 안에서 어디에 있는지 미리 재 두고,
    누른 순간 그 자리로 옮긴다.
  */
  const scrollRef = useRef<ScrollView>(null);
  const fieldTops = useRef<Record<string, number>>({});

  const rememberTop = (key: string) => (event: LayoutChangeEvent) => {
    fieldTops.current[key] = event.nativeEvent.layout.y;
  };

  const reveal = (key: string) => () => {
    const top = fieldTops.current[key];

    if (top === undefined) return;

    // 키보드가 다 올라와 화면이 줄어든 뒤에 옮겨야 실제로 보이는 자리에 놓인다.
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, top - spacing.x4), animated: true });
    }, KEYBOARD_SETTLE_MS);
  };

  const phase = usePinPublishStore((state) => state.phase);
  const progress = usePinPublishStore((state) => state.progress);
  const publishedPinId = usePinPublishStore((state) => state.pinId);
  const error = usePinPublishStore((state) => state.error);
  const publish = usePinPublishStore((state) => state.publish);
  const edit = usePinPublishStore((state) => state.edit);
  const cancelPublish = usePinPublishStore((state) => state.cancel);
  const dismissError = usePinPublishStore((state) => state.dismissError);
  const resetPublish = usePinPublishStore((state) => state.reset);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => {
        setFocused(false);
        form.reset();

        // 업로드 중이면 그대로 두고, 끝난 결과만 지운다. 다시 들어왔을 때 진행률이 이어진다.
        if (usePinPublishStore.getState().phase === 'done') resetPublish();
      };
    }, [form.reset, resetPublish]),
  );

  const submit = () => {
    if (mode.type === 'edit') {
      /*
        수정은 영상이 필수가 아니다. 기존 영상은 서버에 있고, 다시 찍었을 때만 교체된다.
        장소도 이미 정해져 있으므로 확인하지 않는다.
      */
      edit(mode.pinId, initialDraft, form.draft);
      return;
    }

    if (!form.draft.video) {
      Alert.alert('영상을 촬영해 주세요', '갤러리 영상은 등록할 수 없고 실시간 촬영이 필요해요.');
      return;
    }

    if (!form.draft.place) {
      Alert.alert('장소를 선택해 주세요', '현재 위치 주변의 장소를 반드시 골라야 해요.');
      return;
    }

    publish(form.draft);
  };

  // 등록 실패는 진행 화면을 닫고 작성 화면에서 알린다. 입력값은 그대로 남는다.
  useEffect(() => {
    if (!error) return;

    const title = mode.type === 'edit' ? '영상핀을 수정하지 못했어요' : '영상핀을 등록하지 못했어요';
    Alert.alert(title, error, [{ text: '확인', onPress: dismissError }]);
  }, [error, dismissError, mode.type]);

  /**
   * AI 처리까지 끝나면 등록한 핀으로 보낸다.
   *
   * 접수 직후(`PENDING`)에는 상세 조회가 되지 않아 이동하지 않는다. 처리가 끝나 `COMPLETED`가
   * 되면 스토어가 `done`으로 바꾸고, 그때 상세로 넘어간다.
   *
   * 화면을 떠난 뒤에 끝난 경우에는 이동하지 않는다. 사용자가 이미 다른 일을 하고 있으므로
   * 갑자기 화면을 바꾸지 않고, 그 결과는 화면을 벗어날 때 정리한다.
   */
  useEffect(() => {
    if (!focused || phase !== 'done' || publishedPinId === null) return;

    /*
      끝난 것을 알리고 나서 넘어간다.

      바로 상세로 밀어 넣으면 화면만 바뀌어서, 영상이 올라갔는지 이 화면이 그냥 닫힌 것인지
      알 수 없다. 올리는 데 수십 초가 걸리는 흐름이라 끝났다는 말이 있어야 한다.

      스토어는 확인을 누른 뒤에 비운다. 먼저 비우면 이 효과가 한 번 더 돌면서 안내가 두 번 뜬다.
    */
    Alert.alert(
      mode.type === 'edit' ? '영상핀을 수정했어요' : '영상핀을 등록했어요',
      mode.type === 'edit'
        ? '고친 내용이 반영됐어요.'
        : '영상이 공개되어 이제 다른 사람도 볼 수 있어요.',
      [
        {
          text: '확인',
          onPress: () => {
            resetPublish();

            /*
              수정은 그 핀의 상세 **위에 쌓여** 열린다(`/pin/{pinId}/edit`). 상세를 새로 열지
              않고 그 상세까지 닫고 내려간다 — 새로 열면 같은 화면이 두 장 쌓여 뒤로 가기
              한 번에 고치기 전 상세가 나온다. 상세는 다시 보일 때 스스로 새로 받아 오므로
              고친 내용이 반영되고, 거기서 뒤로 가면 들어올 때 지나온 목록으로 이어진다.
            */
            if (mode.type === 'edit') {
              router.dismissTo(`/pin/${mode.pinId}`);
              return;
            }

            /*
              등록은 상세를 **쌓아서** 연다.

              전에는 `replace`로 열었는데, 이 화면이 탭 안에 있어 탭 묶음 자체가 상세로
              바뀌었다 — 스택의 뿌리가 사라져, 그 뒤로는 어느 화면에서 뒤로를 눌러도 돌아갈
              곳이 없어 홈으로 떨어졌다. 탭을 마이페이지의 오늘 핀 목록으로 돌려 두고 그 위에
              상세를 얹으면, 상세에서 뒤로 갔을 때 방금 등록한 핀이 담긴 목록이 나온다.
            */
            router.replace('/(tabs)/mypage/activity');
            router.push(`/pin/${publishedPinId}`);
          },
        },
      ],
    );
  }, [focused, phase, publishedPinId, resetPublish, mode.type]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <PinCreateHeader title={copy.title} />

        {!focused ? null : notReadyToEdit ? (
          /* 수정 진입 — 기존 값을 불러오는 동안에는 폼을 보여주지 않는다. 빈 칸이 잠깐 보이면
             사용자가 값이 지워진 것으로 읽는다. */
          <View style={s.formState}>
            {editable.loading ? (
              <ActivityIndicator color={colors.gray400} />
            ) : (
              <Text style={s.formStateText}>{editable.error}</Text>
            )}
          </View>
        ) : phase !== 'idle' ? (
          <PublishingOverlay phase={phase} progress={progress} onCancel={cancelPublish} />
        ) : (
          /*
            키보드가 덮는 만큼 아래를 비워 둔다.

            이 앱은 화면 끝까지 그리는 방식이라 키보드가 올라와도 창이 줄지 않는다. 그냥 두면
            아래쪽 입력칸이 키보드 뒤에 그대로 남는다. 여백을 주면 스크롤이 보이는 범위 안에서만
            움직인다.

            **아래 고정 영역은 이 여백으로 올라가지 않는다.** 절대 배치라 여백 안쪽이 아니라
            바깥 끝에 붙는다. 그래서 바와 그라데이션은 덮이는 높이만큼 직접 띄운다.
          */
          <View ref={formRef} style={[s.form, { paddingBottom: keyboardOverlap }]}>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              /*
                스크롤이 끝에 닿을 때의 늘어나는 효과(stretch overscroll)를 끈다.

                안드로이드 12부터 끝에 부딪히면 내용 전체가 고무줄처럼 늘어나는데, 카메라
                미리보기는 뷰 계층 밖의 서피스에 그려져 그 변형에 참여하지 못한다. 그 순간
                미리보기가 왼쪽 위로 붙고 나머지가 검게 남았다. 빠르게 스크롤할 때만 보였던
                것도 그때만 끝에 세게 닿기 때문이다.
              */
              overScrollMode="never"
              contentContainerStyle={[
                s.content,
                { paddingBottom: actionBarHeight + bottomOffset - keyboardOverlap + spacing.x4 },
              ]}
            >
              <CrowdLevelSegment value={form.draft.crowdLevel} onChange={form.setCrowdLevel} />

              {/* 수정이면 지금 올라가 있는 영상을 먼저 보여준다. 다시 찍을 때만 교체된다. */}
              <CaptureField
                video={form.draft.video}
                onCaptured={form.setVideo}
                existingVideoUrl={editable.existingVideoUrl}
              />

              <View onLayout={rememberTop('memo')}>
                <MemoField value={form.draft.memo} onChange={form.setMemo} onFocus={reveal('memo')} />
              </View>

              <View onLayout={rememberTop('tag')}>
                <TagField
                  tags={form.draft.tags}
                  onAdd={form.addTag}
                  onRemove={form.removeTag}
                  onFocus={reveal('tag')}
                />
              </View>

              {/* 등록은 카카오 검색, 수정은 우리 DB의 주변 장소에서 고른다. 받는 식별자가 다르다. */}
              <View onLayout={rememberTop('place')}>
                {mode.type === 'edit' ? (
                  <PlaceEditField
                    place={form.draft.place}
                    onSelect={form.setPlace}
                    origin={originPlace}
                  />
                ) : (
                  // 이 자리는 이제 입력칸이 아니라 눌러서 고르는 줄이라 키보드 대응이 필요 없다.
                  <PlaceField
                    place={form.draft.place}
                    onSelect={form.setPlace}
                    droppedPlaceName={form.droppedPlaceName}
                  />
                )}
              </View>

              <View onLayout={rememberTop('detailLocation')}>
                <DetailLocationField
                  value={form.draft.detailLocation}
                  onChange={form.setDetailLocation}
                  onFocus={reveal('detailLocation')}
                />
              </View>
            </ScrollView>

            {/*
              등록 버튼은 늘 보인다. 예전에는 입력칸 아래에 붙어 있어서 끝까지 스크롤해야
              나타났다 — 다 쓰고도 어디서 등록하는지 못 찾는 자리였다.

              내용 위에 겹쳐 놓고 뒤를 흐리게 해서, 아래에 무엇이 더 있는지 비쳐 보이게 한다.
            */}
            {/* 내용이 바 밑으로 들어가며 사라지도록 짧게 덧칠한다. 선 하나보다 조용하다. */}
            <LinearGradient
              pointerEvents="none"
              colors={[FADE_TRANSPARENT, FADE_NEAR_WHITE, colors.white]}
              locations={FADE_STOPS}
              style={[
                s.actionFade,
                { bottom: bottomOffset + actionBarHeight - ACTION_FADE_DROP },
              ]}
            />

            <View
              onLayout={(event) => setActionBarHeight(event.nativeEvent.layout.height)}
              style={[s.actionBar, { bottom: bottomOffset }]}
            >
              <Pressable accessibilityRole="button" onPress={submit} style={s.submit}>
                <Text style={s.submitText}>{copy.submitLabel}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* 탭 밖(수정 라우트)에서는 하단 바를 직접 그린다. 상세 화면과 같은 방식이다. */}
      {mode.type === 'edit' && <AppTabBar />}
    </SafeAreaView>
  );
}
