import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../store/userStore';

export function useLogin() {
  const queryClient = useQueryClient();
  const loginUser = useUserStore((state) => state.loginUser);

  return useMutation({
    mutationFn: ({ email, password }) => loginUser(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries(); // Invalidate all on auth change
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const registerUser = useUserStore((state) => state.registerUser);

  return useMutation({
    mutationFn: (userData) => registerUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const logoutUser = useUserStore((state) => state.logoutUser);

  return useMutation({
    mutationFn: async () => {
      await logoutUser();
    },
    onSuccess: () => {
      queryClient.clear(); // Clear cache on logout
    },
  });
}
