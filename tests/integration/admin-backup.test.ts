import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Admin backup PostgreSQL round trip", () => {
  it("preserves business data, rejects corrupt imports and invalidates sessions and grants", async () => {
    assertTestDatabase(url);
    const isolatedName =
      "oclr_backup_test_" + randomUUID().replaceAll("-", "").slice(0, 12);
    const adminUrl = new URL(url!);
    adminUrl.pathname = "/postgres";
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query('CREATE DATABASE "' + isolatedName + '"');
    const isolatedUrl = new URL(url!);
    isolatedUrl.pathname = "/" + isolatedName;
    const databaseUrl = isolatedUrl.toString();
    const migrationClient = new Client({ connectionString: databaseUrl });
    await migrationClient.connect();
    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" });
    await migrationClient.end();
    const root = mkdtempSync(join(tmpdir(), "oclr-backup-test-"));
    mkdirSync(join(root, "media"));
    mkdirSync(join(root, "bin"));
    writeFileSync(join(root, "key"), randomBytes(32));
    writeFileSync(join(root, "bin/sudo"), "#!/bin/sh\nexit 0\n", {
      mode: 0o700,
    });
    const release = "a".repeat(40);
    const health = createServer((_, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ release }));
    });
    await new Promise<void>((resolve) =>
      health.listen(0, "127.0.0.1", resolve),
    );
    const port = (health.address() as { port: number }).port;
    const env = {
      ...process.env,
      OCLR_OPERATOR_DATA: root,
      OCLR_OPERATOR_KEY: join(root, "key"),
      OCLR_OPERATOR_DATABASE_URL: databaseUrl,
      OCLR_OPERATOR_RELEASE: release,
      OCLR_OPERATOR_RUNTIME_ROLE: decodeURIComponent(new URL(url!).username),
      OCLR_OPERATOR_HEALTH_URL: `http://127.0.0.1:${port}/api/health`,
      OCLR_MEDIA_DIR: join(root, "media"),
      ADMIN_OSU_IDS: "999001",
      PATH: join(root, "bin") + ":" + process.env.PATH,
    };
    async function run(action: string, source?: string, upload?: Buffer) {
      const id = randomUUID();
      writeFileSync(
        join(root, id + ".json"),
        JSON.stringify({ id, action, source, actor: 999001, state: "queued" }),
      );
      if (upload) writeFileSync(join(root, id + ".upload"), upload);
      await new Promise<void>((resolve) => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "operator/worker.ts", id],
          { env, stdio: "ignore" },
        );
        child.on("exit", () => resolve());
      });
      return JSON.parse(readFileSync(join(root, id + ".json"), "utf8"));
    }
    const c = new Client({ connectionString: databaseUrl });
    await c.connect();
    try {
      await c.query(
        "CREATE TABLE IF NOT EXISTS backup_synthetic (id integer primary key, value text not null)",
      );
      await c.query(
        "INSERT INTO backup_synthetic VALUES (1,'snapshot') ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      );
      await c.query(
        "INSERT INTO users(osu_id,username) VALUES(999001,'Synthetic backup Admin') ON CONFLICT DO NOTHING",
      );
      await c.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,999001,now()+interval '1 day') ON CONFLICT DO NOTHING",
        ["b".repeat(64)],
      );
      await c.query(
        "INSERT INTO staff_roles(user_id,role,granted_by) VALUES(999001,'admin',999001) ON CONFLICT DO NOTHING",
      );
      const backup = await run("backup");
      expect(backup.state).toBe("completed");
      const bytes = readFileSync(join(root, backup.id + ".oclr"));
      const bad = Buffer.from(bytes);
      bad[25] ^= 1;
      expect((await run("import", undefined, bad)).state).toBe("failed");
      const imported = await run("import", undefined, bytes);
      expect(imported.state).toBe("validated");
      await c.query("UPDATE backup_synthetic SET value='newer'");
      await c.end();
      writeFileSync(
        join(root, "media", "mismatch.bin"),
        "synthetic newer media",
      );
      expect((await run("restore", imported.id)).state).toBe("failed");
      const preserved = new Client({ connectionString: databaseUrl });
      await preserved.connect();
      expect(
        (await preserved.query("SELECT value FROM backup_synthetic")).rows[0]
          .value,
      ).toBe("newer");
      await preserved.end();
      unlinkSync(join(root, "media", "mismatch.bin"));
      const restored = await run("restore", imported.id);
      expect(restored.state).toBe("completed");
      const target = new Client({ connectionString: databaseUrl });
      await target.connect();
      try {
        expect(
          (await target.query("SELECT value FROM backup_synthetic")).rows[0]
            .value,
        ).toBe("snapshot");
        expect(
          (await target.query("SELECT count(*)::int n FROM sessions")).rows[0]
            .n,
        ).toBe(0);
        expect(
          (
            await target.query(
              "SELECT count(*)::int n FROM staff_roles WHERE revoked_at IS NULL",
            )
          ).rows[0].n,
        ).toBe(0);
      } finally {
        await target.query("DROP TABLE backup_synthetic");
        await target.end();
      }
    } finally {
      await c.end().catch(() => {});
      await new Promise<void>((resolve) => health.close(() => resolve()));
      rmSync(root, { recursive: true, force: true });
      const retained = (
        await admin.query(
          "SELECT datname FROM pg_database WHERE datname=$1 OR datname LIKE $2",
          [isolatedName, isolatedName + "\\_%"],
        )
      ).rows;
      for (const row of retained) {
        if (!row.datname.startsWith(isolatedName))
          throw Error("Unsafe cleanup");
        await admin.query('DROP DATABASE "' + row.datname + '" WITH (FORCE)');
      }
      await admin.end();
    }
  }, 120000);
});
