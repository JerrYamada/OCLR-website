import { networkInterfaces } from "node:os";
type Configuration = {
  healthUrl?: string;
  bindHost?: string;
  port?: string;
  appUrl?: string;
};
/** A read-only probe of this app host, never an arbitrary private-network URL. */
export function operatorHealthTarget(
  config: Configuration,
  addresses = Object.values(networkInterfaces()).flatMap((items) =>
    (items ?? []).map((item) => item.address),
  ),
) {
  const url = new URL(config.healthUrl ?? "");
  if (
    url.protocol !== "http:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/health"
  )
    throw Error("Invalid local health target");
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const parts = url.hostname.split(".").map(Number);
  const privateV4 =
    parts.length === 4 &&
    parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168));
  const expectedPort = config.port || "3000";
  if (
    !/^\d+$/.test(expectedPort) ||
    Number(expectedPort) < 1 ||
    Number(expectedPort) > 65535
  )
    throw Error("Invalid local health port");
  if (
    !loopback &&
    (!privateV4 ||
      url.hostname !== config.bindHost ||
      !addresses.includes(url.hostname) ||
      (url.port || "80") !== expectedPort)
  )
    throw Error("Health target must match a local private listener");
  if (config.port && (url.port || "80") !== expectedPort)
    throw Error("Health target port mismatch");
  let canonicalHost = url.host;
  if (config.appUrl) {
    const app = new URL(config.appUrl);
    if (
      app.username ||
      app.password ||
      app.search ||
      app.hash ||
      app.pathname !== "/" ||
      !["http:", "https:"].includes(app.protocol)
    )
      throw Error("Invalid application origin");
    canonicalHost = app.host;
  }
  return { url, canonicalHost };
}
