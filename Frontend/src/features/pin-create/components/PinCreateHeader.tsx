import { ScreenHeader } from '@/components/common/ui';
import { goBackOrHome } from '@/utils/navigation';

export interface PinCreateHeaderProps {
  /** 생성이면 "게시글 작성", 수정이면 "게시글 수정". */
  title: string;
}

/**
 * 작성 화면 헤더.
 *
 * 모양은 공용 헤더가 정한다. 이 화면이 헤더의 기준이었지만 화면마다 같은 것을 다시 그리면
 * 값이 조금씩 갈라지므로 공용으로 옮겼다.
 *
 * 여기서 정하는 것은 뒤로 가기 동작뿐이다. 작성 화면은 탭에서 바로 들어올 수 있어 되돌아갈
 * 화면이 없을 때가 있고, 그때는 홈으로 보낸다.
 */
export function PinCreateHeader({ title }: PinCreateHeaderProps) {
  return <ScreenHeader title={title} back onBack={goBackOrHome} />;
}
