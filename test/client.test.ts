// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { afterEach, describe, expect, it, vi } from "vitest";
import { AntmanClient, AntmanError, seg } from "../src/client.js";
import { fakeAntman, testConfig } from "./helpers.js";

afterEach(() => vi.unstubAllGlobals());

describe("AntmanClient", () => {
  it("logs in lazily and sends the JWT as a Token header", async () => {
    const api = fakeAntman({ "GET /api/antlets": { body: [{ dname: "web" }] } });
    const client = new AntmanClient(testConfig());

    await expect(client.get("/api/antlets")).resolves.toEqual([{ dname: "web" }]);
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /api/login", "GET /api/antlets"]);
    expect(api.calls[0].body).toEqual({ username: "tester", password: "secret" });
    expect(api.calls[1].auth).toBe("Token test-jwt");
  });

  it("reuses the token across requests", async () => {
    const api = fakeAntman();
    const client = new AntmanClient(testConfig());
    await client.get("/api/a");
    await client.get("/api/b");
    expect(api.calls.filter((c) => c.path === "/api/login")).toHaveLength(1);
  });

  it("shares one login between concurrent requests", async () => {
    const api = fakeAntman();
    const client = new AntmanClient(testConfig());
    await Promise.all([client.get("/api/a"), client.get("/api/b"), client.get("/api/c")]);
    expect(api.calls.filter((c) => c.path === "/api/login")).toHaveLength(1);
  });

  it("logs in again once when the token is rejected", async () => {
    let logins = 0;
    const api = fakeAntman({
      "POST /api/login": () => ({ body: { token: `jwt-${++logins}` } }),
      "GET /api/antlets": (call) => (call.auth === "Token jwt-1" ? { status: 401, body: "expired" } : { body: [] }),
    });
    const client = new AntmanClient(testConfig());

    await expect(client.get("/api/antlets")).resolves.toEqual([]);
    expect(logins).toBe(2);
    expect(api.apiCalls().map((c) => c.auth)).toEqual(["Token jwt-1", "Token jwt-2"]);
  });

  it("accepts a bare-string token and strips a Token prefix", async () => {
    const api = fakeAntman({ "POST /api/login": { body: '"Token abc.def"' } });
    await new AntmanClient(testConfig()).get("/api/x");
    expect(api.apiCalls()[0].auth).toBe("Token abc.def");
  });

  it("uses ANTSLE_TOKEN without logging in", async () => {
    const api = fakeAntman();
    await new AntmanClient(testConfig({ username: undefined, password: undefined, token: "Token pre" })).get("/api/x");
    expect(api.calls.map((c) => c.path)).toEqual(["/api/x"]);
    expect(api.calls[0].auth).toBe("Token pre");
  });

  it("explains when a pre-issued token is rejected and there is no way to log in", async () => {
    fakeAntman({ "GET /api/x": { status: 401, body: "nope" } });
    const client = new AntmanClient(testConfig({ username: undefined, password: undefined, token: "pre" }));
    await expect(client.get("/api/x")).rejects.toThrow(AntmanError);
  });

  it("throws AntmanError with status and body on HTTP errors", async () => {
    fakeAntman({ "GET /api/antlets/nope": { status: 500, body: { message: "(not (map? nil))" } } });
    const err = (await new AntmanClient(testConfig()).get("/api/antlets/nope").catch((e: unknown) => e)) as AntmanError;
    expect(err).toBeInstanceOf(AntmanError);
    expect(err.status).toBe(500);
    expect(err.body).toEqual({ message: "(not (map? nil))" });
  });

  it("reports a login response without a token field", async () => {
    fakeAntman({ "POST /api/login": { body: { user: "root" } } });
    await expect(new AntmanClient(testConfig()).get("/api/x")).rejects.toThrow(/no recognizable token field/);
  });

  it("sends JSON bodies with a content type", async () => {
    const api = fakeAntman();
    await new AntmanClient(testConfig()).post("/api/antlets", { dname: "web" });
    const call = api.apiCalls()[0];
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({ dname: "web" });
  });
});

describe("seg", () => {
  it("encodes a value as a single path segment", () => {
    expect(seg("a/b c")).toBe("a%2Fb%20c");
  });
});
