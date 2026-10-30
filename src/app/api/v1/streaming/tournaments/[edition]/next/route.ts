import { readDataResponse } from "@/lib/developer-api-http";
import type { StreamingReadPrincipal } from "@/lib/streaming-api";
import {
  authenticateStreamingRead,
  streamingOrigins,
  touchStreamingAccess,
} from "@/lib/streaming-api";
import { nextStreamingRead } from "@/lib/streaming-read";
import { extendedSchemas } from "@/lib/extended-read-resources";
async function handle(
  request: Request,
  { params }: { params: Promise<{ edition: string }> },
) {
  const { edition } = await params;
  return readDataResponse<unknown, StreamingReadPrincipal>(
    request,
    "identity:read",
    async (principal, query) => {
      const data = await nextStreamingRead(
        principal!.subject,
        edition,
        Object.fromEntries(query),
      );
      return { data: JSON.parse(JSON.stringify(data)) };
    },
    {
      onSuccess:
        request.method === "GET"
          ? () => touchStreamingAccess(request, edition)
          : undefined,
      origins: streamingOrigins,
      authenticate: (r) => authenticateStreamingRead(r, edition),
      query: ["afterFixtureId"],
      schema: extendedSchemas.nextStreamingRead,
      database: true,
      maxBytes: 2097152,
    },
  );
}
export {
  handle as GET,
  handle as HEAD,
  handle as OPTIONS,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
