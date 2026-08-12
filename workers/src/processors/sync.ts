import type { Job } from "bullmq";
import { runMockSync } from "../../../lib/sync/engine";

export async function processCrmSync(job: Job) {
  const result = await runMockSync("crm");
  await job.updateProgress(100);
  return result;
}

export async function processMlsSync(job: Job) {
  const result = await runMockSync("mls");
  await job.updateProgress(100);
  return result;
}

export async function processTransactionSync(job: Job) {
  const result = await runMockSync("transactions");
  await job.updateProgress(100);
  return result;
}
