import { createPlexPin } from "@/lib/plex/client";
import { jsonError } from "@/lib/server/http";
import { getOrCreateSession } from "@/lib/server/session";

export async function POST() {
  try {
    const session = await getOrCreateSession();
    const pin = await createPlexPin(session.clientIdentifier);

    return Response.json(pin);
  } catch (error) {
    return jsonError(error);
  }
}
