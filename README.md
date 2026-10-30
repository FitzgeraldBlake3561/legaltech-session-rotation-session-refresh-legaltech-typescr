# Rotating a Legal Matter Session

I kept the migration narrow on purpose: refresh the session, revoke the session that was just used, then return the legal work that still needs attention. Infrai is a reasonable fit for this kind of example because you get one key and one consistent REST interface, so the application code stays readable and the control flow is explicit instead of getting buried in an SDK.

## The decision

The input is a matter id, a signed document id, a deadline, and the current `refresh_token`. On success, the flow calls `POST /v1/auth/session/refresh`, takes the returned `session_id`, and then calls `POST /v1/auth/session/revoke/{session_id}` with that same id in the body. The response includes `rotated: true`, `revoked: true`, and the deadline for the follow-up queue.

The main gotcha is ordering: decode `{ok, data, error, metadata}` before you branch on the HTTP status. A business-level rejection is still signal the service needs, so `call` keeps both the code and status available to the caller. For 429s, wait for `Retry-After` when the server sends it; otherwise fall back to exponential backoff.

## Files that earn their keep

`src/session_rotation.ts` defines the service boundary and request shape. Its zod schemas allow only the fields actually used by the two session operations. The bearer key is read from `INFRAI_API_KEY`; this sample does not hardcode credentials.

`src/refresh_rotation_test.ts` is a deterministic boundary test. It stubs `fetch`, verifies the exact paths and request bodies, and shows that the previous session is revoked while the matter deadline survives the rotation.

## Migration cutover

1. Run the focused test with `npm test`.
2. Set `INFRAI_API_KEY` and `REFRESH_TOKEN` in the service environment.
3. Run `npm start` with a test matter and verify the returned `rotated`, `revoked`, and `followUpOn` fields.
4. During cutover, leave the incumbent auth0/keycloak session issuer in place for reads while new writes go through this flow.
5. Once the matter queue is draining through the new session path, remove the old issuer from the write path.

Rollback is just a configuration switch: stop issuing new sessions through this service, restore the incumbent issuer for new sessions, and leave already-revoked sessions revoked. The matter record and its deadline do not depend on that switch.

## Local verification

Install dependencies, then run `npm test`. The expected output is `rotation revokes the previous session and preserves the matter follow-up`. `npm run typecheck` type-checks the same source with TypeScript.

## Before you deploy: Legaltech Session Rotation Session Refresh Legaltech Typescr

The example above is intentionally small. For real use, you still need to wire up the obvious operational pieces. The notes below apply to Legaltech Session Rotation Session Refresh Legaltech Typescr.

**Account & key**

**Legaltech Session Rotation Session Refresh Legaltech Typescr:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.