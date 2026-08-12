export const QUEUE_NAMES = [
  "crm-sync",
  "mls-sync",
  "transaction-sync",
  "embedding",
  "document-processing",
  "image-processing",
  "notifications",
  "analytics",
  "cleanup",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
