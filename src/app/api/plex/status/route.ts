import { getPlexAccount } from "@/lib/plex/client";
import { getSession } from "@/lib/server/session";

export async function GET() {
  const session = await getSession();

  if (!session?.plexToken) {
    return Response.json({ connected: false });
  }

  try {
    const account = await getPlexAccount(session.plexToken, session.clientIdentifier);

    return Response.json({ connected: true, account });
  } catch {
    return Response.json({ connected: true });
  }
}
