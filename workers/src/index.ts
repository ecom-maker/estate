import { Worker } from "bullmq";
import { createRedisConnection } from "./queues";
import {
  processCrmSync,
  processMlsSync,
  processTransactionSync,
} from "./processors/sync";
import {
  processDocumentJob,
  processEmbeddingJob,
} from "./processors/embeddings";

async function main() {
  const connection = createRedisConnection();
  console.log("DMProperties AI worker starting...");

  const workers = [
    new Worker("crm-sync", processCrmSync, { connection }),
    new Worker("mls-sync", processMlsSync, { connection }),
    new Worker("transaction-sync", processTransactionSync, { connection }),
    new Worker("embedding", processEmbeddingJob, { connection }),
    new Worker("document-processing", processDocumentJob, { connection }),
    new Worker(
      "notifications",
      async (job) => {
        console.log("notification job", job.id, job.name);
        return { queued: true };
      },
      { connection },
    ),
    new Worker(
      "cleanup",
      async () => ({ cleaned: true }),
      { connection },
    ),
  ];

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id} failed`, error.message);
    });
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed on ${job.queueName}`);
    });
  }

  console.log(`Registered ${workers.length} workers`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
