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
import { useBackdropBlur } from '@/features/pin-detail/hooks/useBackdropBlur';
import { IllustrationProvider } from '@/features/pin-detail/illustrations';
import { pinDetailStyles as s } from '@/features/pin-detail/styles';
import { isOwnPin } from '@/types/pin';
import type { PinDetail } from '@/types/pin';

/**
 * 게시글 상세 라우트.
 *
 * 3D 장식 영상을 담아 두는 자리(`IllustrationProvider`). 화면에 들어올 때 받지는 않는다 —
 * 이 화면의 주인공은 현장 영상이라 장식까지 함께 받으면 정작 봐야 할 것이 늦게 뜬다.
 * 버튼을 누른 순간에 받고, 다 받은 뒤에 시트를 통째로 띄운다.
 */
export default function PinDetailRoute() {
  return (
    <IllustrationProvider>
      <PinDetailContent />
    </IllustrationProvider>
  );
}

/**
 * 파라미터를 읽고 상태별 화면을 고르는 조립만 한다.
 * 뷰는 `src/components/pin/detail`, 상호작용 로직은 `usePinDetailScreen`에 있다.
 */
function PinDetailContent() {
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
          <ActivityIndicator color={colors.limeText} />
        </View>
      </PinDetailShell>
    );
  }

  if (status === 'error' || !data) {
    const missing = errorCode === 'PIN_NOT_FOUND';

    return (
      <PinDetailShell>
        <ErrorView
          title={missing ? '영상핀을 볼 수 없어요' : '영상핀을 불러오지 못했어요'}
          /*
            없는 핀과 **아직 공개되지 않은 핀**이 같은 오류로 온다.

            상세 조회는 `videoStatus = ACTIVE`인 핀만 준다(`findActivePinDetailById`). 그런데
            장소 상세의 핀 목록은 상태를 보지 않아서(`findActivePinsByPlaceId`) AI 처리 중인
            핀도 카드로 보인다 — 그 카드를 누르면 여기로 온다. "찾을 수 없다"만 적으면 사라진
            글로 읽히므로 두 경우를 함께 알린다.
          */
          message={
            missing
              ? '만료되거나 삭제된 핀이에요. 방금 올라온 핀이라면 아직 공개 준비 중일 수 있어요.'
              : (error ?? '잠시 후 다시 시도해 주세요')
          }
          // 공개를 기다리는 경우가 있어 없는 핀에도 다시 시도를 남긴다. 다만 앞에 두지는 않는다.
          actionLabel={missing ? '홈으로 이동' : '다시 시도'}
          onAction={missing ? goHome : reload}
          secondaryLabel={missing ? '다시 시도' : '홈으로 이동'}
          onSecondary={missing ? reload : goHome}
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

  // 시트가 오르내리는 동안 흐림도 함께 짙어지고 옅어진다. 결제와 채팅 요청이 같은 시트를 쓴다.
  const blurRadius = useBackdropBlur(purchase.open || chat.open);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      {/*
        아래에서 시트가 올라오면 화면 전체를 흐리게 한다.

        `filter`는 스냅샷을 뜨지 않고 뷰의 렌더 노드에 직접 걸리므로 영상까지 함께 흐려진다.
        `BlurView`는 안드로이드에서 영상 표면을 잡지 못해 이 화면에서는 쓸 수 없다
        (`PinDetailMedia` 주석 참고). 시트는 이 묶음 밖에 있어 또렷하게 남는다.
      */}
      <View style={[s.screenContent, { filter: [{ blur: blurRadius }] }]}>
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
          left={leave.done}
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
