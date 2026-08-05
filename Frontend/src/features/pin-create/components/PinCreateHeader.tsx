import { ScreenHeader } from '@/components/common/ui';
// 되살릴 때 함께 푼다: import { goBackOrHome } from '@/utils/navigation';

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
 * 뒤로 가기(<)는 **내보내지 않는다**. 작성은 탭이라 탭 바로 나가면 되고, 이 버튼으로 나가는
 * 길(goBackOrHome)이 홈 화면의 라우팅과 꼬이는 문제가 있어 잠시 걷었다(2026-08-06).
 * 되살리려면 아래 주석의 줄로 바꾼다.
 */
export function PinCreateHeader({ title }: PinCreateHeaderProps) {
  // return <ScreenHeader title={title} back onBack={goBackOrHome} />;
  return <ScreenHeader title={title} />;
}
