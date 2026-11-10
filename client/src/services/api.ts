import type { ApiEnvelope } from "../types/api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5000/api/v1";
const TOKEN_KEY = "voicemunim.accessToken";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  idempotencyKey?: string;
  token?: string | null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, idempotencyKey, token = tokenStore.get(), headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  if (idempotencyKey) requestHeaders.set("Idempotency-Key", idempotencyKey);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T> & { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status}).`,
      response.status,
      payload?.data,
    );
  }
  if (!payload || payload.success !== true) {
    throw new ApiError("The server returned an unexpected response.", response.status);
  }
  return payload.data;
}

export const createIdempotencyKey = () => crypto.randomUUID();

export async function requestBlob(path: string, body: unknown): Promise<Blob> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new ApiError(payload?.error?.message || `Request failed (${response.status}).`, response.status);
  }
  return response.blob();
}
