import { databaseIdentity } from "../../operator/identity";
import { request } from "node:http";
import { requireUser } from "./auth/user";
import { staffAccess } from "./auth/staff";
import { remoteMode } from "./data-source";
import { inReadChannel } from "./read-channel";
import { HttpError } from "./http";
export async function backupActor() {
  if (remoteMode() || inReadChannel())
    throw new HttpError(403, "You do not have permission for this operation.");
  const actor = await requireUser();
  if (
    !(await staffAccess(actor)).some(
      (g) => g.role === "admin" && g.editionSlug === null,
    )
  )
    throw new HttpError(403, "You do not have permission for this operation.");
  return actor;
}
export async function operatorRequest(
  path: string,
  method: string,
  actor: number,
  body?: Buffer,
) {
  const socketPath = process.env.OCLR_OPERATOR_SOCKET;
  if (!socketPath?.startsWith("/"))
    throw new HttpError(503, "Backup service is unavailable.");
  let identity: string;
  try {
    identity = databaseIdentity(process.env.DATABASE_URL || "");
  } catch {
    throw new HttpError(503, "Backup service is unavailable.");
  }
  return new Promise<Buffer>((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path,
        method,
        headers: {
          "X-OCLR-Actor": String(actor),
          "X-OCLR-Database": identity,
          "Content-Length": body?.length || 0,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 64 * 1024 * 1024 + 16384) {
            res.destroy();
            reject(new HttpError(502, "Backup service is unavailable."));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          res.statusCode && res.statusCode < 300
            ? resolve(Buffer.concat(chunks))
            : reject(
                new HttpError(409, "Backup request could not be completed."),
              ),
        );
        res.on("error", () =>
          reject(new HttpError(503, "Backup service is unavailable.")),
        );
      },
    );
    req.setTimeout(30000, () => req.destroy());
    req.on("error", () =>
      reject(new HttpError(503, "Backup service is unavailable.")),
    );
    req.end(body);
  });
}
