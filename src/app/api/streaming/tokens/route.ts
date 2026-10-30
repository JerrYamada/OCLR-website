import { requireBrowserSession } from "@/lib/auth/user";
import { listStreamingTokens, createStreamingToken } from "@/lib/streaming-api";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function GET(request: Request) {
  try {
    return Response.json(
      await listStreamingTokens(
        await requireBrowserSession(),
        new URL(request.url).searchParams.get("edition") ?? "",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireBrowserSession();
    const input = await readJson(request, 4096);
    return Response.json(await createStreamingToken(session, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
