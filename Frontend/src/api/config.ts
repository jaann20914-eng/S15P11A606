/**
 * 요청을 실제 서버로 보낼지 `src/mocks`의 고정 데이터로 처리할지 결정한다.
 *
 * 도메인 모듈이 공통으로 참조하므로 여기 한 곳에만 둔다.
 * `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 별도 설정 없이 목업으로 동작한다.
 */
export const usesMockApi =
  process.env.EXPO_PUBLIC_USE_MOCK_API === 'true' || !process.env.EXPO_PUBLIC_API_BASE_URL;
