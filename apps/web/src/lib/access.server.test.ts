import { describe, it, expect } from "vitest";
import { passwordMatches } from "./access.server";

describe("passwordMatches", () => {
  it("returns true for matching passwords", () => {
    expect(passwordMatches("secret", "secret")).toBe(true);
  });

  it("returns false for non-matching passwords", () => {
    expect(passwordMatches("wrong", "secret")).toBe(false);
  });

  it("returns false when expected is undefined", () => {
    expect(passwordMatches("anything", undefined)).toBe(false);
  });

  it("returns false when expected is empty string", () => {
    expect(passwordMatches("anything", "")).toBe(false);
  });

  it("returns false for different length passwords", () => {
    expect(passwordMatches("short", "a-much-longer-password")).toBe(false);
  });

  it("returns false for empty candidate matching empty expected", () => {
    // empty expected means no password configured → should return false
    expect(passwordMatches("", "")).toBe(false);
  });

  it("handles unicode characters", () => {
    expect(passwordMatches("café☕", "café☕")).toBe(true);
    expect(passwordMatches("café☕", "cafe")).toBe(false);
  });

  it("is case sensitive", () => {
    expect(passwordMatches("Password", "password")).toBe(false);
  });

  it("does not match substrings", () => {
    expect(passwordMatches("pass", "password")).toBe(false);
    expect(passwordMatches("password", "pass")).toBe(false);
  });
});
