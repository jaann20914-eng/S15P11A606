import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/theme';
import { AppTabBar, ConfirmModal, ErrorView } from '@/components/common';
import { OwnerMenu } from '@/features/pin-detail/components/OwnerMenu';
import { PinChatRequestModal } from '@/features/pin-detail/components/PinChatRequestModal';
import { PinDetailBody } from '@/features/pin-detail/components/PinDetailBody';
import { PinDetailHeader } from '@/features/pin-detail/components/PinDetailHeader';
import { PinPurchaseModal } from '@/features/pin-detail/components/PinPurchaseModal';
import { parsePinId, usePinDetail } from '@/features/pin-detail/hooks/usePinDetail';
import { usePinDetailScreen } from '@/features/pin-detail/hooks/usePinDetailScreen';
import { SHEET_EXIT_DURATION } from '@/features/pin-detail/hooks/useSheetTransition';
import { pinDetailStyles as s } from '@/features/pin-detail/styles';
import { isOwnPin } from '@/types/pin';
import type { PinDetail } from '@/types/pin';

/**
 * 게시글 상세 라우트.
 * 파라미터를 읽고 상태별 화면을 고르는 조립만 한다.
 * 뷰는 `src/components/pin/detail`, 상호작용 로직은 `usePinDetailScreen`에 있다.
 */
export default function PinDetailRoute() {
  const { pinId: pinIdParam } = useLocalSearchParams<{ pinId: string }>();
  const pinId = parsePinId(pinIdParam);
  const { status, data, error, errorCode, reload, patchDetail } = usePinDetail(pinId);

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

  return <PinDetailScreen detail={data} onDetailChange={patchDetail} />;
}

/** 로딩·오류 화면이 공유하는 껍데기. 소유 여부를 모르므로 헤더 우측은 비운다. */
function PinDetailShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <PinDetailHeader hideActions />
      {children}
      <AppTabBar />
    </SafeAreaView>
  );
}

function PinDetailScreen({
  detail,
  onDetailChange,
}: {
  detail: PinDetail;
  onDetailChange: (patch: Partial<PinDetail>) => void;
}) {
  const { menu, purchase, chat, remove, leave, evaluation } = usePinDetailScreen(detail, onDetailChange);
  const isMine = isOwnPin(detail);

  /*
    흐림은 시트가 다 내려간 뒤에 거둔다. 곧바로 거두면 시트는 아직 내려가는 중인데 배경만
    선명해져 두 움직임이 어긋난다.
  */
  const [dimmed, setDimmed] = useState(purchase.open);
  useEffect(() => {
    if (purchase.open) {
      setDimmed(true);
      return;
    }

    const timer = setTimeout(() => setDimmed(false), SHEET_EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [purchase.open]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      {/*
        결제 시트가 열리면 화면 전체를 흐리게 한다.

        `filter`는 스냅샷을 뜨지 않고 뷰의 렌더 노드에 직접 걸리므로 영상까지 함께 흐려진다.
        `BlurView`는 안드로이드에서 영상 표면을 잡지 못해 이 화면에서는 쓸 수 없다
        (`PinDetailMedia` 주석 참고). 시트는 이 묶음 밖에 있어 또렷하게 남는다.
      */}
      <View style={[s.screenContent, dimmed && s.screenBlurred]}>
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
          evaluation={evaluation}
          onRequestChat={chat.show}
          onRequestPurchase={purchase.show}
          onLeave={leave.show}
        />

        <AppTabBar />
      </View>

      <PinPurchaseModal
        visible={purchase.open}
        busy={purchase.busy}
        error={purchase.error}
        onCancel={purchase.hide}
        onConfirm={purchase.confirm}
      />

      <PinChatRequestModal
        visible={chat.open}
        busy={chat.busy}
        error={chat.error}
        onCancel={chat.hide}
        onConfirm={chat.confirm}
      />

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
