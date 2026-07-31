import { useLocalSearchParams } from 'expo-router';
import type { PinCreateMode } from '@/types/pinCreate';

/** 화면 문구. 생성과 수정이 같은 화면을 쓰므로 여기서만 갈라 둔다. */
export interface PinCreateCopy {
  title: string;
  submitLabel: string;
}

const copyByType: Record<PinCreateMode['type'], PinCreateCopy> = {
  create: { title: '게시글 작성', submitLabel: '영상핀 등록하기' },
  edit: { title: '게시글 수정', submitLabel: '영상핀 수정하기' },
};

/**
 * 진입 유형을 판별한다.
 *
 * `pinId` 파라미터가 붙어 들어오면 수정, 없으면 생성이다.
 * 라우트를 하나만 두고 파라미터로 갈라서 화면 코드가 중복되지 않게 한다.
 */
export function usePinCreateMode(): { mode: PinCreateMode; copy: PinCreateCopy } {
  const { pinId } = useLocalSearchParams<{ pinId?: string }>();

  // 핀 식별자는 UUID다. 숫자로 파싱하지 않고 값이 있는지만 본다.
  const target = pinId?.trim();
  const mode: PinCreateMode =
    target ? { type: 'edit', pinId: target } : { type: 'create' };

  return { mode, copy: copyByType[mode.type] };
}
