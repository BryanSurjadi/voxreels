const API_URL = process.env.NEXT_PUBLIC_API_URL;
let accessToken: string | null = null;
let refreshRequest: Promise<string> | null = null;

export type AuthResult = {
  accessToken: string;
  user: { id: string; email: string; displayName: string };
  activeWorkspaceId: string;
  role: "OWNER" | "MEMBER";
};

export async function authenticate(
  mode: "login" | "register",
  body: { email: string; password: string; displayName?: string },
) {
  if (!API_URL) throw new Error("The API URL is not configured.");

  const response = await fetch(`${API_URL}/api/v1/auth/${mode}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    data?: AuthResult;
    error?: { message?: string };
  };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Authentication failed. Try again.");
  }

  accessToken = payload.data.accessToken;
  return payload.data;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;
  if (!API_URL) throw new Error("The API URL is not configured.");

  refreshRequest = (async () => {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    const payload = (await response.json()) as {
      data?: { accessToken: string };
      error?: { message?: string };
    };

    if (!response.ok || !payload.data) {
      accessToken = null;
      throw new Error(payload.error?.message ?? "Your session has expired.");
    }

    accessToken = payload.data.accessToken;
    return accessToken;
  })();

  try {
    return await refreshRequest;
  } finally {
    refreshRequest = null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = accessToken ?? (await refreshAccessToken());
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body && { "Content-Type": "application/json" }),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && retry) {
    accessToken = null;
    await refreshAccessToken();
    return apiRequest<T>(path, init, false);
  }

  const payload = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "The request could not be completed.");
  }
  return payload.data;
}

export async function logout() {
  try {
    if (API_URL) {
      await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    }
  } finally {
    accessToken = null;
  }
}
