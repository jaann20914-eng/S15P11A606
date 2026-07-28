// AI 블러 검수 단계는 등록 폼(detail-form) 안에서 처리한다.
// 기획서의 화면 흐름과 경로를 맞추기 위해 라우트만 남겨 두고 폼으로 넘긴다.
import { Redirect } from 'expo-router';

export default function AiReview() {
  return <Redirect href="/pin-create/detail-form" />;
}
