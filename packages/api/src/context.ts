import { auth } from "@crypto-charts/auth";
import type { NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  // Resolve the session defensively: public procedures (e.g. chart data) should work
  // even when the auth DB is unreachable. Protected procedures still require a session.
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({
      headers: req.headers,
    });
  } catch (error) {
    console.error("createContext: failed to resolve session", error);
  }
  return {
    auth: null,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
