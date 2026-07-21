import type { Request } from "express";

export function getBearerToken(request: Request): string | null {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}
