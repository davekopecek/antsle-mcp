// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Dave Kopecek

import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVER_INSTRUCTIONS } from "../src/instructions.js";
import { connect, fakeAntman, testConfig, text } from "./helpers.js";

afterEach(() => vi.unstubAllGlobals());

const WRITE_TOOLS = [
  "antsle_set_antlet_state",
  "antsle_create_antlet",
  "antsle_update_antlet",
  "antsle_clone_antlet",
  "antsle_delete_antlet",
  "antsle_create_snapshot",
  "antsle_restore_snapshot",
  "antsle_delete_snapshot",
  "antsle_install_template",
];

const DESTRUCTIVE_TOOLS = [
  "antsle_set_antlet_state",
  "antsle_delete_antlet",
  "antsle_restore_snapshot",
  "antsle_delete_snapshot",
];

describe("tool registration", () => {
  it("sends server instructions to the client", async () => {
    fakeAntman();
    const mcp = await connect();
    expect(mcp.client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    await mcp.close();
  });

  it("registers read and write tools by default, without the raw API tool", async () => {
    fakeAntman();
    const mcp = await connect();
    const names = (await mcp.client.listTools()).tools.map((t) => t.name);
    for (const name of WRITE_TOOLS) expect(names).toContain(name);
    expect(names).toContain("antsle_list_antlets");
    expect(names).not.toContain("antsle_api_request");
    await mcp.close();
  });

  it("registers only read tools in read-only mode", async () => {
    fakeAntman();
    const mcp = await connect(testConfig({ readOnly: true }));
    const { tools } = await mcp.client.listTools();
    for (const name of WRITE_TOOLS) expect(tools.map((t) => t.name)).not.toContain(name);
    for (const tool of tools) expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    await mcp.close();
  });

  it("annotates destructive and read-only tools", async () => {
    fakeAntman();
    const mcp = await connect();
    const { tools } = await mcp.client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of DESTRUCTIVE_TOOLS) expect(byName.get(name)?.annotations?.destructiveHint, name).toBe(true);
    expect(byName.get("antsle_list_antlets")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(byName.get("antsle_create_snapshot")?.annotations?.destructiveHint).toBe(false);
    await mcp.close();
  });

  it("prefixes every tool name with antsle_", async () => {
    fakeAntman();
    const mcp = await connect(testConfig({ enableRawApi: true }));
    for (const tool of (await mcp.client.listTools()).tools) expect(tool.name).toMatch(/^antsle_[a-z_]+$/);
    await mcp.close();
  });
});

describe("tool calls map onto antMan endpoints", () => {
  const cases: Array<[string, Record<string, unknown>, string, unknown?]> = [
    ["antsle_list_antlets", {}, "GET /api/antlets"],
    ["antsle_get_antlet", { name: "web/1" }, "GET /api/antlets/web%2F1"],
    ["antsle_get_antlet_state", { name: "web" }, "GET /api/antlets/web/state"],
    ["antsle_set_antlet_state", { name: "web", action: "stop" }, "POST /api/antlets/web/state", { action: "stop" }],
    ["antsle_delete_antlet", { name: "web" }, "DELETE /api/antlets/web"],
    ["antsle_delete_antlet", { name: "web", force: true }, "DELETE /api/antlets/force/web"],
    ["antsle_get_antlet_dependencies", { name: "web" }, "GET /api/antlets/web/dependencies"],
    ["antsle_list_snapshots", { antlet: "web" }, "GET /api/antlets/web/snapshots"],
    ["antsle_create_snapshot", { antlet: "web", name: "pre" }, "POST /api/antlets/web", { name: "pre" }],
    ["antsle_restore_snapshot", { antlet: "web", snapshot: "pre" }, "POST /api/antlets/web/snapshots/restore/pre"],
    ["antsle_delete_snapshot", { antlet: "web", snapshot: "pre" }, "DELETE /api/antlets/web/snapshots/pre"],
    ["antsle_list_templates", {}, "GET /api/templates"],
    ["antsle_get_template_statuses", {}, "GET /api/templates-statuses"],
    ["antsle_list_vlans", {}, "GET /api/network/vlans"],
    ["antsle_list_port_forwards", {}, "GET /api/pf-rules"],
    ["antsle_list_backups", {}, "GET /api/backups"],
  ];

  it.each(cases)("%s %j -> %s", async (tool, args, expected, body) => {
    const api = fakeAntman();
    const mcp = await connect();
    const result = await mcp.client.callTool({ name: tool, arguments: args });
    expect(result.isError, text(result)).toBeFalsy();
    const call = api.apiCalls().at(-1)!;
    expect(`${call.method} ${call.path}`).toBe(expected);
    if (body !== undefined) expect(call.body).toEqual(body);
    await mcp.close();
  });

  it("create_antlet sends antMan field names and defaults compression to off", async () => {
    const api = fakeAntman();
    const mcp = await connect();
    await mcp.client.callTool({
      name: "antsle_create_antlet",
      arguments: { name: "web", template: "Fedora.lxc", ram: 1024, cpu: 2, antletNum: 33 },
    });
    expect(api.apiCalls()[0]).toMatchObject({
      method: "POST",
      path: "/api/antlets",
      body: { dname: "web", template: "Fedora.lxc", ram: 1024, cpu: 2, compression: "off", "antlet-num": 33 },
    });
    expect(api.apiCalls()[0].body).not.toHaveProperty("zpool-name");
    await mcp.close();
  });

  it("update_antlet keeps current RAM and CPU when they aren't given", async () => {
    const api = fakeAntman({ "GET /api/antlets/web": { body: { dname: "web", ram: 2048, cpu: 4 } } });
    const mcp = await connect();
    await mcp.client.callTool({ name: "antsle_update_antlet", arguments: { name: "web", autostart: true } });
    const put = api.apiCalls().find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ dname: "web", ram: 2048, cpu: 4, autostart: true });
    await mcp.close();
  });

  it("clone_antlet nests source and destination", async () => {
    const api = fakeAntman();
    const mcp = await connect();
    await mcp.client.callTool({
      name: "antsle_clone_antlet",
      arguments: { source: "web", snapshot: "pre", name: "web-test", antletNum: 40 },
    });
    expect(api.apiCalls()[0]).toMatchObject({
      path: "/api/antlets/clone",
      body: {
        "src-antlet": { dname: "web", "snapshot-name": "pre" },
        "dst-antlet": { dname: "web-test", "antlet-num": 40, "zpool-name": "antlets", compression: "off" },
      },
    });
    await mcp.close();
  });

  it("rejects invalid arguments before calling antMan", async () => {
    const api = fakeAntman();
    const mcp = await connect();
    const result = await mcp.client.callTool({ name: "antsle_set_antlet_state", arguments: { name: "web", action: "explode" } });
    expect(result.isError).toBe(true);
    expect(api.apiCalls()).toHaveLength(0);
    await mcp.close();
  });
});

describe("errors", () => {
  it("returns antMan errors as isError results with a hint for missing items", async () => {
    fakeAntman({ "GET /api/antlets/ghost": { status: 500, body: { message: "(not (map? nil))" } } });
    const mcp = await connect();
    const result = await mcp.client.callTool({ name: "antsle_get_antlet", arguments: { name: "ghost" } });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/HTTP 500/);
    expect(text(result)).toMatch(/does not exist/);
    await mcp.close();
  });

  it("reports network failures with their cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") });
      }),
    );
    const mcp = await connect();
    const result = await mcp.client.callTool({ name: "antsle_list_antlets", arguments: {} });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/ECONNREFUSED/);
    await mcp.close();
  });
});

describe("antsle_api_request", () => {
  it("passes requests through when enabled", async () => {
    const api = fakeAntman();
    const mcp = await connect(testConfig({ enableRawApi: true }));
    await mcp.client.callTool({
      name: "antsle_api_request",
      arguments: { method: "PUT", path: "/api/pf-rules/1", body: { port: 80 } },
    });
    expect(api.apiCalls()[0]).toMatchObject({ method: "PUT", path: "/api/pf-rules/1", body: { port: 80 } });
    await mcp.close();
  });

  it("requires paths under /api/", async () => {
    const api = fakeAntman();
    const mcp = await connect(testConfig({ enableRawApi: true }));
    const result = await mcp.client.callTool({ name: "antsle_api_request", arguments: { method: "GET", path: "/etc/passwd" } });
    expect(result.isError).toBe(true);
    expect(api.apiCalls()).toHaveLength(0);
    await mcp.close();
  });

  it("allows only GET in read-only mode and blocks host power endpoints", async () => {
    const api = fakeAntman();
    const mcp = await connect(testConfig({ enableRawApi: true, readOnly: true }));

    const post = await mcp.client.callTool({ name: "antsle_api_request", arguments: { method: "POST", path: "/api/antlets" } });
    expect(post.isError).toBe(true);
    expect(text(post)).toMatch(/only GET/);

    const shutdown = await mcp.client.callTool({
      name: "antsle_api_request",
      arguments: { method: "GET", path: "/api/antsle-shutdown?now=1" },
    });
    expect(shutdown.isError).toBe(true);
    expect(text(shutdown)).toMatch(/blocked in read-only mode/);

    expect(api.apiCalls()).toHaveLength(0);

    const get = await mcp.client.callTool({ name: "antsle_api_request", arguments: { method: "GET", path: "/api/antlets" } });
    expect(get.isError).toBeFalsy();
    await mcp.close();
  });
});
