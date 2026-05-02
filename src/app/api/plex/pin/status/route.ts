import { getPlexAccount, getPlexPin, PlexRequestError } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { getOrCreateSession, setPlexToken } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    const session = await getOrCreateSession();
    const pinId = new URL(request.url).searchParams.get("pinId");

    if (!pinId) {
      return Response.json({ error: "Missing pinId." }, { status: 400 });
    }

    const pin = await getPlexPin(session.clientIdentifier, pinId);

    if (pin.authToken) {
      await setPlexToken(session, pin.authToken);
      const account = await getPlexAccount(pin.authToken, session.clientIdentifier);

      return Response.json({ connected: true, account });
    }

    return Response.json({ connected: false });
  } catch (error) {
    if (error instanceof PlexRequestError && error.status === 404) {
      return Response.json({ error: "Plex authorization PIN was not found or has expired." }, { status: 404 });
    }

    return jsonError(error);
  }
}
