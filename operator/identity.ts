import { createHash } from "node:crypto";
/** Compare runtime/operator targets without transmitting database credentials. */
export function databaseIdentity(value: string) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1)
  )
    throw Error("Invalid database target");
  return createHash("sha256")
    .update(
      JSON.stringify([
        url.hostname,
        url.port || "5432",
        decodeURIComponent(url.pathname.slice(1)),
      ]),
    )
    .digest("hex");
}
