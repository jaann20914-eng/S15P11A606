import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useAppTabBarHeight } from '@/components/common/AppTabBar';
import { colors, spacing } from '@/constants/theme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
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
import { pinCreateStyles as s } from '@/features/pin-create/styles';
import { usePinPublishStore } from '@/store/usePinPublishStore';
import { EMPTY_PIN_DRAFT } from '@/types/pinCreate';
import type { PinDraft } from '@/types/pinCreate';

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
  const keyboardHeight = useKeyboardHeight();
  const tabBarHeight = useAppTabBarHeight();

  /*
    키보드가 이 화면을 덮는 높이.

    키보드 높이는 창 맨 아래를 기준으로 재는데, 그 아래에는 탭바가 깔려 있다. 그 값을 그대로
    쓰면 탭바 높이만큼 더 밀려 버튼 아래에 빈 자리가 생긴다. 실제로 이 화면을 덮는 만큼만
    비운다.
  */
  const keyboardOverlap = Math.max(0, keyboardHeight - tabBarHeight);

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

    resetPublish();
    router.replace(`/pin/${publishedPinId}`);
  }, [focused, phase, publishedPinId, resetPublish]);

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
            아래쪽 입력칸과 고정된 등록 버튼이 키보드 뒤에 그대로 남는다. 키보드 높이만큼
            여백을 주면 그 위 영역에서만 배치돼, 버튼은 키보드 바로 위로 올라오고 스크롤도
            보이는 범위 안에서 움직인다.
          */
          <View style={[s.form, { paddingBottom: keyboardOverlap }]}>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.content}
            >
              <CrowdLevelSegment value={form.draft.crowdLevel} onChange={form.setCrowdLevel} />

              <CaptureField video={form.draft.video} onCaptured={form.setVideo} />

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
                  <PlaceField
                    place={form.draft.place}
                    onSelect={form.setPlace}
                    droppedPlaceName={form.droppedPlaceName}
                    onFocus={reveal('place')}
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
            */}
            <View style={s.actionBar}>
              <Pressable accessibilityRole="button" onPress={submit} style={s.submit}>
                <Text style={s.submitText}>{copy.submitLabel}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
