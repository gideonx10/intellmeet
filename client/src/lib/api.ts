import axios from "axios";

import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

const AUTH_STORAGE_KEY = "auth-storage";

function readPersistedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };

    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: string | null; refreshToken?: string | null };
    };

    return {
      accessToken: parsed.state?.accessToken ?? null,
      refreshToken: parsed.state?.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function getAuthTokens() {
  const { accessToken, refreshToken } = useAuthStore.getState();

  if (accessToken || refreshToken) {
    return { accessToken, refreshToken };
  }

  return readPersistedAuth();
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const { accessToken } = getAuthTokens();

  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthRoute = typeof original?.url === "string" && original.url.includes("/auth/");

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        const { refreshToken } = getAuthTokens();
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken });
        useAuthStore.setState((state) => ({
          ...state,
          accessToken: data.accessToken,
        }));
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;