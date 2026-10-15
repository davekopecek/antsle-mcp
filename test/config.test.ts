// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";

// Point at a .env that doesn't exist so a developer's real .env never leaks into tests.
beforeEach(() => {
  for (const key of Object.keys(process.env)) if (key.startsWith("ANTSLE_")) vi.stubEnv(key, undefined);
  vi.stubEnv("ANTSLE_ENV_FILE", "/nonexistent/antsle-mcp-test.env");
});
afterEach(() => vi.unstubAllEnvs());

describe("loadConfig", () => {
  it("requires ANTSLE_URL", () => {
    vi.stubEnv("ANTSLE_TOKEN", "abc");
    expect(() => loadConfig()).toThrow(/ANTSLE_URL is required/);
  });

  it("requires a token or username and password", () => {
    vi.stubEnv("ANTSLE_URL", "http://a.local:3000");
    vi.stubEnv("ANTSLE_USERNAME", "root");
    expect(() => loadConfig()).toThrow(/ANTSLE_USERNAME and ANTSLE_PASSWORD, or ANTSLE_TOKEN/);
  });

  it("strips trailing slashes and parses flags", () => {
    vi.stubEnv("ANTSLE_URL", "https://myantsle.antsle.us///");
    vi.stubEnv("ANTSLE_TOKEN", "abc");
    vi.stubEnv("ANTSLE_READ_ONLY", "Yes");
    vi.stubEnv("ANTSLE_ENABLE_RAW_API", "0");
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://myantsle.antsle.us");
    expect(config.readOnly).toBe(true);
    expect(config.enableRawApi).toBe(false);
  });

  it("falls back to the default timeout for invalid values", () => {
    vi.stubEnv("ANTSLE_URL", "http://a.local:3000");
    vi.stubEnv("ANTSLE_TOKEN", "abc");
    vi.stubEnv("ANTSLE_TIMEOUT_MS", "soon");
    expect(loadConfig().timeoutMs).toBe(60000);
    vi.stubEnv("ANTSLE_TIMEOUT_MS", "1500");
    expect(loadConfig().timeoutMs).toBe(1500);
  });
});
