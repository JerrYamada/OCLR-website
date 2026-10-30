import { it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
it("accepts the supported existing Node 22 runtime and rejects older or invalid versions", () => {
  const root = mkdtempSync(join(tmpdir(), "oclr-node-check-"));
  try {
    for (const [version, accepted] of [
      ["v22.23.2", true],
      ["v22.13.0", true],
      ["v24.22.2", true],
      ["v22.12.9", false],
      ["v20.19.0", false],
      ["invalid", false],
    ] as const) {
      const executable = join(root, "node");
      writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`, {
        mode: 0o700,
      });
      const result = spawnSync("/bin/bash", [
        "scripts/check-node-version.sh",
        executable,
      ]);
      expect(result.status === 0, version).toBe(accepted);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("previews installation without running host tools or touching configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "oclr-installer-"));
  const script = join(process.cwd(), "scripts/install-backup-operator.sh");
  try {
    expect(spawnSync("/bin/bash", ["-n", script]).status).toBe(0);
    const output = execFileSync(
      "/bin/bash",
      [script, "--ref", "a".repeat(40), "--dry-run"],
      { env: { PATH: root, NODE_ENV: "test" }, encoding: "utf8" },
    );
    expect(output).toContain("Do not start the service");
    expect(output).toContain("root-owned operator release");
    expect(
      spawnSync("/bin/bash", [script, "--ref", "main", "--apply"], {
        env: { PATH: root, NODE_ENV: "test" },
      }).status,
    ).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("hashes private media through the fixed helper and rejects symlink roots", () => {
  const root = mkdtempSync(join(tmpdir(), "oclr-media-"));
  try {
    writeFileSync(join(root, "private.bin"), "synthetic", { mode: 0o600 });
    const output = execFileSync(
      process.execPath,
      ["operator/media-fingerprint.mjs", root],
      { encoding: "utf8" },
    );
    expect(output.trim()).toMatch(/^[a-f0-9]{64}$/);
    writeFileSync(join(root, "private.bin"), "changed", { mode: 0o600 });
    expect(
      execFileSync(process.execPath, ["operator/media-fingerprint.mjs", root], {
        encoding: "utf8",
      }),
    ).not.toBe(output);
    symlinkSync(root, join(root, "linked"));
    expect(
      spawnSync(process.execPath, [
        "operator/media-fingerprint.mjs",
        join(root, "linked"),
      ]).status,
    ).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
