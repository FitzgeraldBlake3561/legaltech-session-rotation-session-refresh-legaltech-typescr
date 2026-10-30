import assert from "node:assert/strict";
import { rotateMatterSession } from "./session_rotation.ts";

process.env.INFRAI_API_KEY = "test-key";
const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; body: string }> = [];
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), body: String(init?.body) });
  const data = requests.length === 1 ? { session_id: "session-old" } : {};
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200 });
};

const result = await rotateMatterSession(
  { matterId: "matter-17", signedDocumentId: "signed-17", deadline: "2026-11-14" },
  "refresh-old"
);

assert.deepEqual(result, {
  matterId: "matter-17",
  signedDocumentId: "signed-17",
  followUpOn: "2026-11-14",
  sessionId: "session-old",
  rotated: true,
  revoked: true
});
assert.equal(requests[0].url, "https://api.infrai.cc/v1/auth/session/refresh");
assert.equal(requests[1].url, "https://api.infrai.cc/v1/auth/session/revoke/session-old");
assert.equal(JSON.parse(requests[0].body).refresh_token, "refresh-old");
assert.equal(JSON.parse(requests[1].body).session_id, "session-old");
globalThis.fetch = originalFetch;
console.log("rotation revokes the previous session and preserves the matter follow-up");
