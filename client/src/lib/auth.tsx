import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function loginRequest(data: { username: string; password: string }) {
  console.log("[auth] POST /api/auth/login", { username: data.username });
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  console.log("[auth] login response status:", res.status);
  if (!res.ok) {
    let message = "Login failed";
    try {
      const body = await res.json();
      message = body.message || body.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

async function getCurrentUser() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export function useAuth() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });
}
