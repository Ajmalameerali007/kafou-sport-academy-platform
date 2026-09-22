# Local demo access

At the user's explicit request, 20 September 2026, the authenticator requirement is optional for the active synthetic `admin.kafou@example.com` owner in the isolated `kafou-local` database. Email/password authentication, original roles and active-account checks remain in place. The real authentication assurance level remains `aal1`; it is not rewritten to `aal2`.

Enable with `node scripts/local-demo-mfa.mjs enable`; restore the original requirement with `node scripts/local-demo-mfa.mjs disable`. The guarded operator script accepts the exact local Supabase URL and named local database container only, checks the account's synthetic/active/owner markers and saves the original four function definitions in ignored local output before applying the override. It does not modify any hosted project or source migration.

The server accepts the database-issued exemption only when both its configured Auth database and application are local loopback HTTP endpoints. Hosted and HTTPS runtimes strip the exemption even if a database response contains it. The exemption never comes from a browser form, URL parameter or user metadata. Do not apply the local SQL override to a hosted database or distribute local database dumps as production configuration.

The previous meeting acceptance evidence describes the standard MFA-required build. This subsequent local-demo exception is verified separately by the runtime guard/role tests and authenticated local owner API/UI inspection. Deployment packages built before this change are unchanged and retain their original MFA behavior.
