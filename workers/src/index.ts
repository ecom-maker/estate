import { Worker } from "bullmq";
import { createRedisConnection } from "./queues";
import {
  processCrmSync,
  processMlsSync,
  processTransactionSync,
} from "./processors/sync";

async function main() {
  const connection = createRedisConnection();
  console.log("DMProperties AI worker starting...");

  const workers = [
    new Worker("crm-sync", processCrmSync, { connection }),
    new Worker("mls-sync", processMlsSync, { connection }),
    new Worker("transaction-sync", processTransactionSync, { connection }),
    new Worker(
      "embedding",
      async (job) => {
        console.log("embedding job", job.id, job.data);
        return { ok: true };
      },
      { connection },
    ),
    new Worker(
      "document-processing",
      async (job) => {
        console.log("document-processing job", job.id, job.data);
        return { ok: true };
      },
      { connection },
    ),
  ];

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id} failed`, error.message);
    });
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed`);
    });
  }

  console.log(`Registered ${workers.length} workers`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
