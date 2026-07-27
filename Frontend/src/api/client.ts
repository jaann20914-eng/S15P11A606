import type { ApiResponse } from '@/types/common';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았어요');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new Error('잠시 후 다시 시도해 주세요');
  }

  return response.json() as Promise<ApiResponse<T>>;
}
