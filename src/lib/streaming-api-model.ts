export const streamingApiScopes = ["streaming:read"] as const;
export type StreamingApiScope = (typeof streamingApiScopes)[number];
export type StreamingTokenMetadata = {
  id: string;
  editionSlug: string;
  origin: string;
  scopes: StreamingApiScope[];
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
export const streamingTokenPrefix = "oclr_stream_";
export function validStreamingToken(value: string) {
  return /^oclr_stream_[A-Za-z0-9_-]{43}$/.test(value);
}
