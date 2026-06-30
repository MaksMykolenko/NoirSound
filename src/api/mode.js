export const useMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';

export function isMockMode() {
  return useMockApi;
}
