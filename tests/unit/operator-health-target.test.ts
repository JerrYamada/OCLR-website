import { describe, it, expect } from "vitest";
import { operatorHealthTarget } from "../../operator/health";
describe("operator local health target", () => {
  it("retains loopback compatibility and canonical Host", () => {
    expect(
      operatorHealthTarget(
        {
          healthUrl: "http://127.0.0.1:3100/api/health",
          appUrl: "https://oclr.example.test",
        },
        [],
      ).canonicalHost,
    ).toBe("oclr.example.test");
  });
  it("allows only the explicitly configured local private listener", () => {
    const config = {
      healthUrl: "http://10.20.0.5:3000/api/health",
      bindHost: "10.20.0.5",
      port: "3000",
    };
    expect(operatorHealthTarget(config, ["10.20.0.5"]).url.hostname).toBe(
      "10.20.0.5",
    );
    for (const patch of [
      { bindHost: "10.20.0.6" },
      { port: "3001" },
      { healthUrl: "http://10.20.0.6:3000/api/health" },
    ])
      expect(() =>
        operatorHealthTarget({ ...config, ...patch }, ["10.20.0.5"]),
      ).toThrow();
    expect(() => operatorHealthTarget(config, [])).toThrow();
  });
  it("rejects remote/public targets, wildcard listeners and non-health requests", () => {
    for (const healthUrl of [
      "http://8.8.8.8:3000/api/health",
      "http://0.0.0.0:3000/api/health",
      "https://127.0.0.1:3000/api/health",
      "http://127.0.0.1:3000/",
      "http://user:secret@127.0.0.1:3000/api/health",
      "http://127.0.0.1:3000/api/health?token=secret",
    ])
      expect(() =>
        operatorHealthTarget(
          { healthUrl, bindHost: new URL(healthUrl).hostname },
          [new URL(healthUrl).hostname],
        ),
      ).toThrow();
  });
});
