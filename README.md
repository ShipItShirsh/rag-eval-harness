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
