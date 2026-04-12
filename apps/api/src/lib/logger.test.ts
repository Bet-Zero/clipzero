import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, serializeError } from "./logger";

describe("serializeError", () => {
  it("serializes an Error instance", () => {
    const err = new Error("test failure");
    const result = serializeError(err);
    expect(result).toEqual({
      errorName: "Error",
      errorMessage: "test failure",
      stack: expect.any(String),
    });
  });

  it("serializes a TypeError instance", () => {
    const err = new TypeError("cannot read property");
    const result = serializeError(err);
    expect(result.errorName).toBe("TypeError");
    expect(result.errorMessage).toBe("cannot read property");
  });

  it("serializes a string error", () => {
    const result = serializeError("something went wrong");
    expect(result).toEqual({ errorMessage: "something went wrong" });
  });

  it("serializes a number error", () => {
    const result = serializeError(42);
    expect(result).toEqual({ errorMessage: "42" });
  });

  it("serializes null", () => {
    const result = serializeError(null);
    expect(result).toEqual({ errorMessage: "null" });
  });

  it("serializes undefined", () => {
    const result = serializeError(undefined);
    expect(result).toEqual({ errorMessage: "undefined" });
  });
});

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logger.info writes to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test message");
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.level).toBe("info");
    expect(output.message).toBe("test message");
    expect(output.ts).toBeDefined();
  });

  it("logger.info includes metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("with meta", { key: "value", count: 42 });
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.meta).toEqual({ key: "value", count: 42 });
  });

  it("logger.warn writes to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("warning message");
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.level).toBe("warn");
    expect(output.message).toBe("warning message");
  });

  it("logger.error writes to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("error message");
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.level).toBe("error");
    expect(output.message).toBe("error message");
  });

  it("logger.info default meta is empty object", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("no meta");
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.meta).toEqual({});
  });

  it("handles circular references in metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    // This should not throw
    logger.info("circular", circular);
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.message).toBe("circular");
  });
});
