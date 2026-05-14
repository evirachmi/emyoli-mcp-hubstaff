import { describe, expect, it } from "vitest";
import { requestBodyContainsInitialize } from "../src/httpTransport.js";

describe("requestBodyContainsInitialize", () => {
  it("detects a single initialize JSON-RPC message", () => {
    expect(
      requestBodyContainsInitialize({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
        id: 1,
      }),
    ).toBe(true);
  });

  it("detects initialize inside a batch array", () => {
    expect(
      requestBodyContainsInitialize([
        { jsonrpc: "2.0", method: "ping", id: 1 },
        {
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1" },
          },
          id: 2,
        },
      ]),
    ).toBe(true);
  });

  it("returns false for unrelated bodies", () => {
    expect(requestBodyContainsInitialize({ jsonrpc: "2.0", method: "tools/list", id: 1 })).toBe(false);
    expect(requestBodyContainsInitialize(null)).toBe(false);
  });
});
