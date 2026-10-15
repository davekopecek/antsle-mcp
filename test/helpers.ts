// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

// Test helpers: a fake antMan (stubbed global fetch) and an in-memory MCP client.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { vi } from "vitest";
import type { Config } from "../src/config.js";
import { createServer } from "../src/server.js";

export const BASE_URL = "http://antsle.test:3000";

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  auth: string | null;
}

type Reply = { status?: number; body?: unknown } | ((call: RecordedCall) => { status?: number; body?: unknown });

/**
 * Stubs global fetch with a tiny fake antMan. Routes are keyed "METHOD /path"; unmatched
 * requests return 200 with an empty JSON object. /api/login returns a token unless overridden.
 * Every request (including logins) is recorded in `calls`.
 */
export function fakeAntman(routes: Record<string, Reply> = {}) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const call: RecordedCall = {
      method: init?.method ?? "GET",
      path: url.pathname + url.search,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      auth: headers.get("authorization"),
    };
    calls.push(call);

    const key = `${call.method} ${call.path}`;
    const route = routes[key] ?? (key === "POST /api/login" ? { body: { token: "test-jwt" } } : { body: {} });
    const { status = 200, body } = typeof route === "function" ? route(call) : route;
    const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock, apiCalls: () => calls.filter((c) => c.path !== "/api/login") };
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl: BASE_URL,
    username: "tester",
    password: "secret",
    readOnly: false,
    enableRawApi: false,
    timeoutMs: 5000,
    ...overrides,
  };
}

/** Connects a real MCP client to the server over an in-memory transport. */
export async function connect(config: Config = testConfig()) {
  const server = createServer(config);
  const client = new Client({ name: "antsle-mcp-tests", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    server,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** Text of the first content item of a tool result. */
export function text(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  return content[0]?.text ?? "";
}
