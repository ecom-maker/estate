# AI

## Providers

Initial provider: **OpenAI only**.

## Pipeline

1. Intent extraction (heuristic fallback without API key; structured LLM when configured)
2. Zod validation (`SearchIntentSchema`)
3. Search Service + ranking
4. Streaming summary via `/api/chat`

## Property assistant

Scoped to a single property ID. Answers only from property + related records + RAG chunks when indexed.

## Admin control panel

`/admin/ai` stores encrypted keys, model config, and usage logs.

## Cost tracking

`AiLog` stores tokens, latency, feature, status — never secrets.
