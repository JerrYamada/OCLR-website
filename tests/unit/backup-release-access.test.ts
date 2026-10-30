import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const script = resolve("scripts/backup-release-access.sh");
function fixture(realAcl = false) {
  const dir = realpathSync(
    mkdtempSync(join(tmpdir(), "oclr-marker-access-test-")),
  );
  const root = join(dir, "site"),
    release = join(root, "releases/first");
  const bin = join(dir, "bin"),
    log = join(dir, "calls");
  mkdirSync(release, { recursive: true, mode: 0o700 });
  mkdirSync(bin);
  const marker = join(release, ".oclr-release");
  writeFileSync(marker, "a".repeat(40) + "\n", { mode: 0o600 });
  writeFileSync(join(release, "private.bin"), "synthetic private data", {
    mode: 0o600,
  });
  writeFileSync(log, "");
  writeFileSync(
    join(bin, "id"),
    '#!/bin/bash\n[[ ${NO_OPERATOR-} != 1 ]] || exit 1\nprintf "99998\\n"\n',
    { mode: 0o700 },
  );
  if (!realAcl)
    writeFileSync(
      join(bin, "setfacl"),
      '#!/bin/bash\nprintf "%s\\n" "$@" >> "$ACL_TEST_LOG"\n',
      { mode: 0o700 },
    );
  const run = (args = [root, release], extra = {}) =>
    spawnSync("/bin/bash", [script, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        ACL_TEST_LOG: log,
        ...extra,
      },
    });
  return {
    root,
    release,
    marker,
    bin,
    log,
    run,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

it("leaves hosts without an operator unchanged", () => {
  const f = fixture();
  try {
    expect(f.run(undefined, { NO_OPERATOR: "1" }).status).toBe(0);
    expect(readFileSync(f.log, "utf8")).toBe("");
    expect(statSync(f.marker).mode & 0o777).toBe(0o600);
  } finally {
    f.cleanup();
  }
});

it("rejects an external release or a symlinked marker without changing ACLs", () => {
  const f = fixture();
  try {
    expect(f.run([f.root, f.root]).status).not.toBe(0);
    unlinkSync(f.marker);
    symlinkSync(join(f.release, "private.bin"), f.marker);
    expect(f.run().status).not.toBe(0);
    expect(readFileSync(f.log, "utf8")).toBe("");
  } finally {
    f.cleanup();
  }
});

it("rejects invalid release metadata before granting access", () => {
  const f = fixture();
  try {
    writeFileSync(f.marker, "invalid");
    expect(f.run().status).not.toBe(0);
    expect(readFileSync(f.log, "utf8")).toBe("");
  } finally {
    f.cleanup();
  }
});

it("fails preflight with an actionable message when ACL tools are missing", () => {
  const f = fixture();
  try {
    unlinkSync(join(f.bin, "setfacl"));
    const result = f.run(["--check"], { PATH: f.bin });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sudo dnf install acl");
    expect(readFileSync(f.log, "utf8")).toBe("");
  } finally {
    f.cleanup();
  }
});

it("preflights without changes, then grants only traversal and marker reading", () => {
  const f = fixture();
  try {
    expect(f.run(["--check"]).status).toBe(0);
    expect(readFileSync(f.log, "utf8")).toBe("");
    expect(f.run().status).toBe(0);
    expect(readFileSync(f.log, "utf8").trim().split("\n")).toEqual([
      "-m",
      "u:99998:--x",
      "--",
      f.root,
      join(f.root, "releases"),
      f.release,
      "-m",
      "u:99998:r--",
      "--",
      f.marker,
    ]);
    expect(statSync(join(f.release, "private.bin")).mode & 0o777).toBe(0o600);
  } finally {
    f.cleanup();
  }
});

it.skipIf(process.platform !== "linux")(
  "applies real Linux ACLs without granting directory listing, writes or inherited file access",
  () => {
    const f = fixture(true);
    try {
      const result = f.run();
      expect(result.status, result.stderr).toBe(0);
      const acl = (path: string) => {
        const r = spawnSync("getfacl", ["-cpn", "--", path], {
          encoding: "utf8",
        });
        expect(r.status, r.stderr).toBe(0);
        return r.stdout;
      };
      for (const dir of [f.root, join(f.root, "releases"), f.release]) {
        expect(acl(dir)).toContain("user:99998:--x");
        expect(acl(dir)).not.toContain("default:");
      }
      expect(acl(f.marker)).toContain("user:99998:r--");
      expect(acl(f.marker)).toContain("other::---");
      const secret = join(f.release, "private.bin");
      expect(acl(secret)).not.toContain("user:99998:");
      expect(statSync(secret).mode & 0o777).toBe(0o600);
      const next = join(f.root, "releases/next");
      mkdirSync(next, { mode: 0o700 });
      expect(acl(next)).not.toContain("user:99998:");
      expect(f.run().status).toBe(0);
    } finally {
      f.cleanup();
    }
  },
);
