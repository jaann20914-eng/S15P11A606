import type { AgeGroup, Gender } from '@/types/onboarding';

/**
 * 온보딩 선택지 단일 소스.
 *
 * `value`는 서버 enum이고 `label`은 화면 문구다. 선호 카테고리(`categories.ts`)와 같은 방식으로,
 * 화면 상태에 한글 문구를 담아 두고 전송할 때 변환하지 않는다 —
 * 변환표를 따로 두면 문구를 고칠 때 서버 값이 조용히 어긋난다.
 */
export const ageGroups: readonly { value: AgeGroup; label: string }[] = [
  { value: 'TEENS', label: '10대' },
  { value: 'TWENTIES', label: '20대' },
  { value: 'THIRTIES', label: '30대' },
  { value: 'FORTIES', label: '40대' },
  { value: 'FIFTIES', label: '50대' },
  { value: 'SIXTIES', label: '60대' },
  { value: 'SEVENTIES_AND_OVER', label: '70대+' },
];

export const genders: readonly { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: '여' },
  { value: 'MALE', label: '남' },
];

/** 닉네임 길이 제한. 서버가 최종 검증하지만 입력 단계에서 먼저 막는다. */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;
