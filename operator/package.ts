import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export const MAX_BYTES = 64 * 1024 * 1024;
export type Manifest = {
  format: 1;
  createdAt: string;
  source: string;
  release: string;
  schema: string;
  postgres: number;
  media: false;
  mediaHash?: string;
  counts?: Record<string, string>;
  sha256: string;
};
export function seal(
  dump: Buffer,
  metadata: Omit<Manifest, "format" | "sha256" | "media">,
  key: Buffer,
) {
  if (key.length !== 32 || dump.length > MAX_BYTES)
    throw Error("Invalid package");
  const manifest: Manifest = {
    ...metadata,
    format: 1,
    media: false,
    sha256: createHash("sha256").update(dump).digest("hex"),
  };
  const header = Buffer.from(JSON.stringify(manifest));
  if (header.length > 8192) throw Error("Manifest exceeds limit");
  const size = Buffer.alloc(4);
  size.writeUInt32BE(header.length);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([
    Buffer.from("OCLR369\n"),
    iv,
    cipher.update(Buffer.concat([size, header, dump])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}
export function open(bundle: Buffer, key: Buffer) {
  if (
    bundle.length < 40 ||
    bundle.length > MAX_BYTES + 16384 ||
    bundle.subarray(0, 8).toString() !== "OCLR369\n"
  )
    throw Error("Invalid package");
  const cipher = createDecipheriv("aes-256-gcm", key, bundle.subarray(8, 20));
  cipher.setAuthTag(bundle.subarray(-16));
  const plain = Buffer.concat([
    cipher.update(bundle.subarray(20, -16)),
    cipher.final(),
  ]);
  const length = plain.readUInt32BE();
  if (length > 8192 || length < 2 || length + 4 > plain.length)
    throw Error("Invalid manifest");
  const manifest = JSON.parse(
    plain.subarray(4, 4 + length).toString(),
  ) as Manifest;
  const dump = plain.subarray(4 + length);
  if (
    manifest.format !== 1 ||
    manifest.media !== false ||
    typeof manifest.source !== "string" ||
    manifest.source.length > 120 ||
    !Number.isInteger(manifest.postgres) ||
    manifest.postgres < 14 ||
    manifest.postgres > 99 ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !/^\d{4}-/.test(manifest.createdAt) ||
    !/^[a-f0-9]{64}$/.test(manifest.schema) ||
    !/^[a-f0-9]{40}$/.test(manifest.release) ||
    createHash("sha256").update(dump).digest("hex") !== manifest.sha256
  )
    throw Error("Invalid manifest");
  return { manifest, dump };
}
