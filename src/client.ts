// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import type { Config } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export class AntmanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "AntmanError";
  }
}

/** Encodes a value for use as a single path segment, e.g. an antlet name. */
export function seg(value: string): string {
  return encodeURIComponent(value);
}

function stripTokenPrefix(raw: string): string {
  return raw.trim().replace(/^"|"$/g, "").replace(/^Token\s+/i, "");
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Thin client for the antMan REST API. Logs in lazily with username/password,
 * caches the JWT, and logs in again once if a request comes back 401/403.
 */
export class AntmanClient {
  private token?: string;
  private loginInFlight?: Promise<string>;

  constructor(private readonly config: Config) {
    if (config.token) this.token = stripTokenPrefix(config.token);
  }

  async request<T = unknown>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    let res = await this.send(method, path, body, await this.getToken());
    if ((res.status === 401 || res.status === 403) && this.canLogin()) {
      this.token = undefined;
      res = await this.send(method, path, body, await this.getToken());
    }

    const data = await parseBody(res);
    if (!res.ok) {
      throw new AntmanError(`${method} ${path} failed with HTTP ${res.status}`, res.status, data);
    }
    return data as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }

  private send(method: HttpMethod, path: string, body: unknown, token: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Token ${token}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return fetch(this.config.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
  }

  private canLogin(): boolean {
    return Boolean(this.config.username && this.config.password);
  }

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    if (!this.canLogin()) {
      throw new Error("ANTSLE_TOKEN was rejected and no ANTSLE_USERNAME/ANTSLE_PASSWORD are set to log in again");
    }
    this.loginInFlight ??= this.login().finally(() => {
      this.loginInFlight = undefined;
    });
    this.token = await this.loginInFlight;
    return this.token;
  }

  private async login(): Promise<string> {
    const res = await fetch(this.config.baseUrl + "/api/login", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ username: this.config.username, password: this.config.password }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    const data = await parseBody(res);
    if (!res.ok) {
      throw new AntmanError(`antMan login failed with HTTP ${res.status}`, res.status, data);
    }

    // The spec does not document the response shape, so accept a bare string or a common token field.
    if (typeof data === "string" && data.trim()) return stripTokenPrefix(data);
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      for (const key of ["token", "jwt", "access-token", "access_token", "accessToken"]) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) return stripTokenPrefix(value);
      }
      throw new AntmanError(
        `antMan login response had no recognizable token field (keys: ${Object.keys(obj).join(", ")})`,
        res.status,
        null,
      );
    }
    throw new AntmanError("antMan login returned an empty response", res.status, null);
  }
}
