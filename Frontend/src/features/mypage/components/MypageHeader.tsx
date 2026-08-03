import { ScreenHeader } from '@/components/common/ui';
import { goBackOrHome } from '@/utils/navigation';

export interface MypageHeaderProps {
  title: string;
}

/**
 * 마이페이지 하위 화면 헤더.
 *
 * 모양은 공용 헤더가 정한다. 예전에는 제목이 14/600 회색이라 다른 화면보다 작고 흐렸다.
 */
export function MypageHeader({ title }: MypageHeaderProps) {
  return <ScreenHeader title={title} back onBack={goBackOrHome} />;
}
