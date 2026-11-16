Use the shared `PasswordInput` for editable password fields; it keeps visibility controls, focus, and cursor behavior consistent across forms.

Certificate initial release is enforced by a database BEFORE INSERT trigger, not browser-provided state, so direct client inserts cannot bypass academic approval. Student download entry points must require the persisted emitted state.

Certificate integration tests use a dedicated privileged test database and transaction rollback to exercise authenticated roles without retaining certificates, audit entries, or notifications; never use the read-only sandbox connection for role impersonation.
- Public form submissions (course requests) are inserted only by the validated server endpoint with the service role; never re-add an open INSERT policy, so unvalidated rows cannot bypass the endpoint.
