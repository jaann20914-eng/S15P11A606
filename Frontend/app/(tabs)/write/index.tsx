import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

/**
 * 게시글 작성 · 수정 화면.
 *
 * `pinId` 파라미터가 붙어 들어오면 수정, 없으면 생성이다. 두 흐름이 같은 화면을 쓰고
 * 문구와 제출 대상만 갈린다.
 *
 * 등록을 누르면 진행 화면으로 덮고 그 상태에 머문다. MVP에서는 실패 복구를 다루지 않는다.
 */
export default function PinCreateScreen() {
  const { mode, copy } = usePinCreateMode();
  const form = usePinCreateForm();
  const [publishing, setPublishing] = useState(false);
  const tabBarHeight = useAppTabBarHeight();

  const submit = () => {
    if (!form.draft.video) {
      Alert.alert('영상을 촬영해 주세요', '갤러리 영상은 등록할 수 없고 실시간 촬영이 필요해요.');
      return;
    }

    if (!form.draft.place) {
      Alert.alert('장소를 선택해 주세요', '현재 위치 주변의 장소를 반드시 골라야 해요.');
      return;
    }

    setPublishing(true);

    // 요청은 다음 단계에서 붙인다. 등록과 수정이 다른 엔드포인트를 쓰므로 여기서 갈린다.
    if (mode.type === 'edit') {
      // PATCH /api/v1/pins/{pinId} — mode.pinId를 쓴다.
      return;
    }

    // POST /api/v1/pins
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.screen}>
        <PinCreateHeader title={copy.title} />

        {publishing ? (
          <PublishingOverlay />
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
