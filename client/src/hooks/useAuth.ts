import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface AuthPayload {
  name?: string;
  email: string;
  password: string;
}

export const useSignup = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: AuthPayload) => api.post("/auth/signup", data),
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate("/dashboard");
    },
  });
};

export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: AuthPayload) => api.post("/auth/login", data),
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate("/dashboard");
    },
  });
};

export const useLogout = () => {
  const { clearAuth, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.post("/auth/logout", { refreshToken }),
    onSettled: () => {
      clearAuth();
      navigate("/login");
    },
  });
};