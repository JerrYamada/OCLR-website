import { afterEach, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { operatorRequest } from "@/lib/admin-backups";
afterEach(() => vi.unstubAllEnvs());
it("distinguishes an absent installation from an unreachable daemon without exposing configuration", async () => {
  vi.stubEnv("OCLR_OPERATOR_SOCKET", "");
  await expect(operatorRequest("/jobs", "GET", 1)).rejects.toMatchObject({
    status: 503,
    code: "not_configured",
  });
  vi.stubEnv(
    "OCLR_OPERATOR_SOCKET",
    "/private/tmp/oclr-backup-missing-test.sock",
  );
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://synthetic:private-value@localhost/oclr_status_test",
  );
  await expect(operatorRequest("/jobs", "GET", 1)).rejects.toMatchObject({
    status: 503,
    code: "unreachable",
    message: "Backup service is unavailable.",
  });
});
it("distinguishes rejection and restores normal reads when the service recovers", async () => {
  const root = mkdtempSync(join(tmpdir(), "oclr-status-")),
    socket = join(root, "operator.sock");
  let rejected = true;
  const server = createServer((_, res) => {
    res.statusCode = rejected ? 400 : 200;
    res.end(rejected ? "internal diagnostic not for clients" : "[]");
  });
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  vi.stubEnv("OCLR_OPERATOR_SOCKET", socket);
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://synthetic@localhost/oclr_status_test",
  );
  try {
    await expect(operatorRequest("/jobs", "GET", 1)).rejects.toMatchObject({
      code: "rejected",
      message: "Backup service is unavailable.",
    });
    await expect(
      operatorRequest("/download/expired", "GET", 1),
    ).rejects.toMatchObject({
      status: 409,
      message: "Backup request could not be completed.",
    });
    rejected = false;
    expect((await operatorRequest("/jobs", "GET", 1)).toString()).toBe("[]");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
