import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "./names";

export function createRedisConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function createQueues(connection = createRedisConnection()) {
  return QUEUE_NAMES.map(
    (name) =>
      new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
  );
}
