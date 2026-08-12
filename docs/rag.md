# RAG

Knowledge documents are stored in PostgreSQL metadata + Supabase Storage binaries.

## Pipeline

```text
Upload → Storage → Document record → BullMQ job
  → extract text → clean → chunk → embed → pgvector → mark indexed
```

## Query

Structured filters always apply for numeric constraints. Semantic similarity ranks supporting knowledge and soft relevance.

## Safety

Only indexed chunks from trusted documents are eligible for retrieval. The assistant must cite whether an answer is from DB facts vs retrieved knowledge.
