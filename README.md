# rag-eval-harness

A tiny docs-grounded Q&A app, plus the evaluation system that answers one
question: **did the AI get worse?** A golden dataset of questions with
known-good expectations runs through graders in CI, so a prompt, model, or
retrieval change that drops quality turns the build red with named
failures.

Built to learn AI evaluation in public — my first eval project, applying
13 years of test-strategy experience to a new kind of system. The corpus
is 100% synthetic (a fictional product, "TaskNest"); the default provider
is a deterministic mock, so the whole suite runs free with no API key.

## Status

Phase 1 of 4 (the app under test) is built. The evaluation system —
golden dataset, graders, prompt variants, CI gates — is specified in
[SPEC.md](SPEC.md) and lands in the following phases. The full README
arrives with Phase 4.

## Run the app

```bash
npm ci
npm start          # http://localhost:3000 — chat page + POST /api/ask
npm test           # unit tests
npm run typecheck
```

Ask it something the help centre covers ("What is the refund policy?")
and something it doesn't — the app abstains with a fixed "I don't have
information about that in the help centre" instead of guessing.
