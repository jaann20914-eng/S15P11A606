import { ActivityIndicator, SafeAreaView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/theme';
import { AppTabBar, ConfirmModal, ErrorView } from '@/components/common';
import {
  OwnerMenu,
  PinChatRequestModal,
  PinDetailBody,
  PinDetailHeader,
  PinPurchaseModal,
  pinDetailStyles as s,
} from '@/components/pin/detail';
import { parsePinId, usePinDetail } from '@/hooks/usePinDetail';
import { usePinDetailScreen } from '@/hooks/usePinDetailScreen';
import type { PinDetail, PinViewerState } from '@/types/pin';

/**
 * 게시글 상세 라우트.
 * 파라미터를 읽고 상태별 화면을 고르는 조립만 한다.
 * 뷰는 `src/components/pin/detail`, 상호작용 로직은 `usePinDetailScreen`에 있다.
 */
export default function PinDetailRoute() {
  const { pinId: pinIdParam } = useLocalSearchParams<{ pinId: string }>();
  const pinId = parsePinId(pinIdParam);
  const { status, data, error, errorCode, reload, patchViewer } = usePinDetail(pinId);

  const goHome = () => router.replace('/(tabs)/home');

  // 경로에 숫자가 아닌 값이 들어오면 요청 자체를 하지 않으므로 여기서 끊는다.
  if (pinId === null) {
    return (
      <PinDetailShell>
        <ErrorView
          title="영상핀을 찾을 수 없어요"
          message="주소가 올바르지 않아요."
          actionLabel="홈으로 이동"
          onAction={goHome}
        />
      </PinDetailShell>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <PinDetailShell>
        <View style={s.stateArea}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      </PinDetailShell>
    );
  }

  if (status === 'error' || !data) {
    // 없는 핀은 재시도해도 소용없으므로 홈으로 보내고, 그 외에는 다시 시도를 준다.
    const missing = errorCode === 'PIN_NOT_FOUND';

    return (
      <PinDetailShell>
        <ErrorView
          title={missing ? '영상핀을 찾을 수 없어요' : '영상핀을 불러오지 못했어요'}
          message={error ?? '잠시 후 다시 시도해 주세요'}
          actionLabel={missing ? '홈으로 이동' : '다시 시도'}
          onAction={missing ? goHome : reload}
          secondaryLabel={missing ? undefined : '홈으로 이동'}
          onSecondary={goHome}
        />
      </PinDetailShell>
    );
  }

  return <PinDetailScreen detail={data} onViewerChange={patchViewer} />;
}

/** 로딩·오류 화면이 공유하는 껍데기. 소유 여부를 모르므로 헤더 우측은 비운다. */
function PinDetailShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe}>
      <PinDetailHeader hideActions />
      {children}
      <AppTabBar />
    </SafeAreaView>
  );
}

function PinDetailScreen({
  detail,
  onViewerChange,
}: {
  detail: PinDetail;
  onViewerChange: (patch: Partial<PinViewerState>) => void;
}) {
  const { menu, purchase, chat, remove, leave, rate } = usePinDetailScreen(detail, onViewerChange);
  const isMine = detail.viewer.isMine;

  return (
    <SafeAreaView style={s.safe}>
      <PinDetailHeader menu={isMine ? { open: menu.open, onToggle: menu.toggle } : undefined} />

      {menu.open && (
        <OwnerMenu
          onEdit={menu.edit}
          onDelete={() => {
            menu.hide();
            remove.show();
          }}
          onDismiss={menu.hide}
        />
      )}

      <PinDetailBody
        detail={detail}
        onRequestChat={chat.show}
        onRequestPurchase={purchase.show}
        onRate={rate}
        onLeave={leave.show}
      />

      <AppTabBar />

      <PinPurchaseModal visible={purchase.open} onCancel={purchase.hide} onConfirm={purchase.confirm} />

      <PinChatRequestModal visible={chat.open} onCancel={chat.hide} onConfirm={chat.confirm} />

      <ConfirmModal
        visible={remove.open}
        title="영상핀 삭제"
        message={'삭제한 영상핀은 되돌릴 수 없어요.\n연결된 채팅방도 함께 종료됩니다.'}
        confirmLabel="삭제"
        busy={remove.busy}
        error={remove.error}
        onCancel={remove.hide}
        onConfirm={remove.confirm}
      />

      <ConfirmModal
        visible={leave.open}
        title="이미 떠났어요"
        message={'이 핀에 연결된 채팅방이 모두 종료돼요.\n영상핀과 크레딧은 그대로 남습니다.'}
        confirmLabel="떠나기"
        busy={leave.busy}
        error={leave.error}
        onCancel={leave.hide}
        onConfirm={leave.confirm}
      />
    </SafeAreaView>
  );
}
