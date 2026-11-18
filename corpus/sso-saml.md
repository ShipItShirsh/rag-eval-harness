---
id: sso-saml
title: Single sign-on (SSO / SAML)
---

# Single sign-on (SSO / SAML)

Single sign-on is available on the **Business plan only**. TaskNest
supports SAML 2.0 and works with Okta, Microsoft Entra ID, and Google
Workspace as identity providers.

To set up SSO, a workspace owner goes to **Settings → Security → Single
sign-on** and follows the setup steps: enter your identity provider's
metadata URL, then copy TaskNest's entity ID and reply URL back into your
identity provider. Setup takes about 15 minutes.

When SSO is enabled, members sign in with the identity provider and do
not have a separate TaskNest password. The workspace owner can keep one
email-and-password admin account as a break-glass login in case the
identity provider is unavailable.

SCIM provisioning is not currently supported; members are still invited
by email and matched to their SSO identity on first sign-in.
