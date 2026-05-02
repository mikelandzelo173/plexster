import { clearSession } from "@/lib/server/session";

export async function DELETE() {
  await clearSession();

  return Response.json({ connected: false });
}
