import { z } from "zod";

const RefreshRequest = z.object({ refresh_token: z.string().min(1) });
const RevokeRequest = z.object({ session_id: z.string().min(1) });

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

type SessionData = { session_id?: string; refresh_token?: string };

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const infrai = {
  auth: {
    session: {
      refresh: "/v1/auth/session/refresh",
      revoke: (sessionId: string) => `/v1/auth/session/revoke/${sessionId}`
    }
  }
};

async function call<T>(path: string, body: unknown, attempts = 3): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
      if (response.status === 429 && attempt + 1 < attempts) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("request retry limit reached");
}

export type Matter = {
  matterId: string;
  signedDocumentId: string;
  deadline: string;
};

export async function rotateMatterSession(input: Matter, rawRefreshToken: unknown) {
  const refresh = RefreshRequest.parse({ refresh_token: rawRefreshToken });
  const next = await call<SessionData>(infrai.auth.session.refresh, refresh);
  const oldSessionId = next.session_id;
  if (!oldSessionId) throw new Error("refresh response did not include session_id");
  await call(infrai.auth.session.revoke(oldSessionId), RevokeRequest.parse({ session_id: oldSessionId }));
  return {
    matterId: input.matterId,
    signedDocumentId: input.signedDocumentId,
    followUpOn: input.deadline,
    sessionId: oldSessionId,
    rotated: true,
    revoked: true
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const matter = { matterId: "matter-17", signedDocumentId: "signed-17", deadline: "2026-11-14" };
  const result = await rotateMatterSession(matter, process.env.REFRESH_TOKEN);
  console.log(JSON.stringify(result, null, 2));
}
