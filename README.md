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

## The problem this solves

Imagine a company puts a chatbot on its help page. The chatbot answers
customer questions using the company's help documents — refund policy,
password reset, billing, that kind of thing.

One day someone edits the chatbot's instructions to make it sound
friendlier. Harmless — except after that edit, the chatbot starts
inventing a refund policy that doesn't exist, and confidently tells
customers they can get refunds the company never offers. Nobody notices
for weeks, because nobody re-checked the chatbot after the edit. And you
can't check it the normal testing way: the chatbot never answers in
exactly the same words twice, so a test that expects one exact answer
fails even when the answer is fine.

This project is an exam for that chatbot:

- **30 fixed questions** — the same questions every time — with an answer
  key: what a correct answer must say, what it must never say, and which
  questions it must honestly answer with "I don't know."
- Every time anything changes — the instructions, the model, the
  documents — the chatbot **takes the exam again, automatically**, and
  gets a grade.
- If the grade drops, the change is **blocked**, and the report names
  what went wrong: it invented a price, it answered a question it should
  have said "I don't know" to.

The small help-centre chatbot in this repo is a practice chatbot, built
so there is a real chatbot to give the exam to. **The exam is the
project.**

## Status

Phases 1–3 of 4 are built: the app under test, the evaluation system
(30-task golden dataset, deterministic graders, Promptfoo, 3 trials per
task), the prompt variants, and the CI gates. Measured with the mock
provider (`npm run eval`, `npm run eval:v2`, `npm run eval:broken`):

| Prompt | pass^3 | What it shows |
| --- | --- | --- |
| v1 (baseline) | 30/30 | The reference score |
| v2 | 30/30 | Same operational settings; its wording changes target a live model, so the mock scores it identically — the difference is measured on live runs |
| broken | 6/30 | v1 with the citation rule removed and retrieval depth cut to 1: every answerable task fails, with the failures named (missing citation, missing fact) |

The GitHub Actions gate re-runs the mock eval on every pull request and
push, and fails the build below 90% pass^3. A live-provider eval
(manual/nightly, your own API key) appends its score to
`results/history.json`. The Playwright layer and the full README are
Phase 4. The plan is in [SPEC.md](SPEC.md).

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
