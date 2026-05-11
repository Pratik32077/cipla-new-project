import { useGetMe, useLogin, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function useAuth() {
  const { data: user, isLoading, error } = useGetMe();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const login = async (employeeCode: string, password: string) => {
    return loginMutation.mutateAsync(
      { data: { employeeCode, password } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetMeQueryKey(), user);
          if (user.role === "admin") {
            setLocation("/dashboard");
          } else {
            setLocation("/dashboard");
          }
        },
      }
    );
  };

  const logout = async () => {
    await logoutMutation.mutateAsync(undefined as unknown as void);
    queryClient.clear();
    setLocation("/login");
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    login,
    logout,
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}
