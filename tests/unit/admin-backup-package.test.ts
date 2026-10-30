import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { seal, open } from "../../operator/package";
const metadata = {
  createdAt: "2026-10-30T00:00:00.000Z",
  source: "synthetic-test",
  release: "a".repeat(40),
  schema: "b".repeat(64),
  postgres: 17,
};
describe("private backup package", () => {
  it("round trips only with the operator key and authenticates all bytes", () => {
    const key = randomBytes(32),
      dump = Buffer.from("synthetic private data");
    const bundle = seal(dump, metadata, key);
    expect(bundle.includes(dump)).toBe(false);
    expect(open(bundle, key).dump).toEqual(dump);
    expect(open(bundle, key).manifest.media).toBe(false);
    expect(() => open(bundle, randomBytes(32))).toThrow();
    for (const index of [8, 20, bundle.length - 1]) {
      const corrupt = Buffer.from(bundle);
      corrupt[index] ^= 1;
      expect(() => open(corrupt, key)).toThrow();
    }
  });
  it("rejects arbitrary SQL, truncation and malformed manifest fields", () => {
    const key = randomBytes(32);
    expect(() => open(Buffer.from("DROP DATABASE example"), key)).toThrow();
    expect(() =>
      open(seal(Buffer.from("x"), metadata, key).subarray(0, 25), key),
    ).toThrow();
    expect(() =>
      open(
        seal(Buffer.from("x"), { ...metadata, schema: "unknown" }, key),
        key,
      ),
    ).toThrow();
  });
});
