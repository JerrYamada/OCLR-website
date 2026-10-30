import { databaseIdentity } from "../../operator/identity";
import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { request } from "node:http";
it("a denied deployment lock leaves a retryable job without starting a worker", async () => {
  const root = mkdtempSync(join(tmpdir(), "oclr-lock-test-"));
  mkdirSync(join(root, "bin"));
  // Simulate flock rejecting acquisition before invoking any worker/database command.
  writeFileSync(join(root, "bin/flock"), "#!/bin/sh\nexit 1\n", {
    mode: 0o700,
  });
  const socket = join(root, "operator.sock");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "operator/server.ts"],
    {
      env: {
        ...process.env,
        PATH: join(root, "bin") + ":" + process.env.PATH,
        OCLR_OPERATOR_DATABASE_URL:
          "postgresql://synthetic@localhost/oclr_lock_test",
        OCLR_OPERATOR_DATA: root,
        OCLR_OPERATOR_SOCKET: socket,
        OCLR_OPERATOR_LOCK: join(root, "lock"),
      },
      stdio: "ignore",
    },
  );
  const call = (
    method: string,
    path: string,
    target = "postgresql://synthetic@localhost/oclr_lock_test",
  ) =>
    new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const req = request(
        {
          socketPath: socket,
          path,
          method,
          headers: {
            "X-OCLR-Actor": "1",
            "X-OCLR-Database": databaseIdentity(target),
          },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () =>
            resolve({ status: res.statusCode!, data: JSON.parse(body) }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await call("GET", "/jobs");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    expect(ready).toBe(true);
    expect(
      (
        await call(
          "POST",
          "/jobs?action=backup",
          "postgresql://synthetic@localhost/other_test",
        )
      ).status,
    ).toBe(400);
    expect((await call("GET", "/jobs")).data).toEqual([]);
    expect((await call("POST", "/jobs?action=backup")).status).toBe(202);
    let job: { state: string; recovery?: string } | undefined;
    for (let i = 0; i < 100; i++) {
      job = (
        (await call("GET", "/jobs")).data as {
          state: string;
          recovery?: string;
        }[]
      )[0];
      if (job?.state === "failed") break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(job).toMatchObject({
      state: "failed",
      recovery: "original-preserved",
    });
    expect((await call("POST", "/jobs?action=backup")).status).toBe(202);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
