export function jsonError(error: unknown, fallbackStatus = 500): Response {
  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : fallbackStatus;

  return Response.json({ error: message }, { status });
}
