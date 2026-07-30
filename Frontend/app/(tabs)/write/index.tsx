import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useAppTabBarHeight } from '@/components/common/AppTabBar';
import { CaptureField } from '@/features/pin-create/components/CaptureField';
import { CrowdLevelSegment } from '@/features/pin-create/components/CrowdLevelSegment';
import { DetailLocationField } from '@/features/pin-create/components/DetailLocationField';
import { MemoField } from '@/features/pin-create/components/MemoField';
import { PinCreateHeader } from '@/features/pin-create/components/PinCreateHeader';
import { PlaceField } from '@/features/pin-create/components/PlaceField';
import { PublishingOverlay } from '@/features/pin-create/components/PublishingOverlay';
import { TagField } from '@/features/pin-create/components/TagField';
import { usePinCreateForm } from '@/features/pin-create/hooks/usePinCreateForm';
import { usePinCreateMode } from '@/features/pin-create/hooks/usePinCreateMode';
import { pinCreateStyles as s } from '@/features/pin-create/styles';
import { usePinPublishStore } from '@/store/usePinPublishStore';

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
  const form = usePinCreateForm();
  const tabBarHeight = useAppTabBarHeight();
  const [focused, setFocused] = useState(false);

  const phase = usePinPublishStore((state) => state.phase);
  const progress = usePinPublishStore((state) => state.progress);
  const publishedPinId = usePinPublishStore((state) => state.pinId);
  const error = usePinPublishStore((state) => state.error);
  const publish = usePinPublishStore((state) => state.publish);
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
    if (!form.draft.video) {
      Alert.alert('영상을 촬영해 주세요', '갤러리 영상은 등록할 수 없고 실시간 촬영이 필요해요.');
      return;
    }

    if (!form.draft.place) {
      Alert.alert('장소를 선택해 주세요', '현재 위치 주변의 장소를 반드시 골라야 해요.');
      return;
    }

    if (mode.type === 'edit') {
      // 수정 API는 아직 명세가 없다. 등록과 다른 엔드포인트를 쓰므로 여기서 갈린다.
      Alert.alert('수정은 아직 준비 중이에요');
      return;
    }

    publish(form.draft);
  };

  // 등록 실패는 진행 화면을 닫고 작성 화면에서 알린다. 입력값은 그대로 남는다.
  useEffect(() => {
    if (!error) return;

    Alert.alert('영상핀을 등록하지 못했어요', error, [{ text: '확인', onPress: dismissError }]);
  }, [error, dismissError]);

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

        {!focused ? null : phase !== 'idle' ? (
          <PublishingOverlay phase={phase} progress={progress} onCancel={cancelPublish} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.content, { paddingBottom: tabBarHeight + 40 }]}
          >
            <CrowdLevelSegment value={form.draft.crowdLevel} onChange={form.setCrowdLevel} />

            <CaptureField video={form.draft.video} onCaptured={form.setVideo} />

            <MemoField value={form.draft.memo} onChange={form.setMemo} />

            <TagField tags={form.draft.tags} onAdd={form.addTag} onRemove={form.removeTag} />

            <PlaceField place={form.draft.place} onSelect={form.setPlace} />

            <DetailLocationField value={form.draft.detailLocation} onChange={form.setDetailLocation} />

            <Pressable accessibilityRole="button" onPress={submit} style={s.submit}>
              <Text style={s.submitText}>{copy.submitLabel}</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
