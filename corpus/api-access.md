---
id: api-access
title: API access and tokens
---

# API access and tokens

The TaskNest API is available on the **Pro and Business plans**. It is a
REST API that returns JSON. With it you can list, create, and update
projects and tasks, and read workspace members.

To create a token, go to **Settings → API → Create token**. A token is
shown **only once** when it is created — copy it immediately. Tokens do
not expire, but you can revoke a token at any time from the same page;
revoking takes effect immediately.

The API rate limit is **600 requests per minute per workspace**. If you
exceed it, the API returns HTTP **429** and you should wait for the
period shown in the `Retry-After` header.

A token acts with the permissions of the user who created it. API calls
cannot change billing settings or delete the workspace, even with an
owner's token.
