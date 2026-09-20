-- Run in Supabase SQL Editor (Dashboard → SQL) before first migrate/push.
-- Enables pgvector for RAG embeddings.

create extension if not exists vector;
create extension if not exists pg_trgm;
