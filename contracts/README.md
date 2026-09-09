# MarkAI native client contract

The authoritative server types are `lib/chat/types.ts`. The Android client sends
the same JSON fields to the existing routes; it does not call model providers.

- `GET /api/public/mobile-config`: `{ cloudMode: boolean, protocolVersion: 1 }`.
- `POST /api/chat`: `messages`, `model`, `provider`, `sessionId`, `webSearchEnabled`, optional `timezone`.
- Chat responses use `application/x-ndjson`, one JSON event per line. UTF-8 bytes
  and lines may split anywhere; the last line need not end with a newline.
- Events: `content`, `reasoning`, `tool`, `file`, `image`, `usage`.
- Persisted segments: `content`, `thinking`, `tool`, `generated-file`,
  `generated-image`, `translation`, `quote`, `context-boundary`.
- Message roles are `user` and `model`. Provider and model identify a pair.
- `PUT /api/sessions/:id/messages` sends `{ messages, revision }` and returns
  `{ messages, session }`. A 409 must not be retried with a new revision without
  reconciling the remote state. Preserve the local recovery copy.
- `/api/chat` does not save conversation messages. The client saves the final
  or interrupted message through the session endpoint.
- Authentication uses Better Auth session cookies; unauthenticated protected
  API routes return JSON 401. Website routes retain their login redirect.
- Files upload through presign → independent PUT → complete. Downloads may
  redirect to object storage. Never forward the API Cookie or Origin headers
  to the object-storage client.

`fixtures/chat-stream.ndjson` is deterministic synthetic data for protocol tests,
not captured user content. Unknown message fields are retained on round trips.
