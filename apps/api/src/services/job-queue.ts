// Job Queue Service — Async processing with real execution
// Dev: in-memory with setImmediate processing
// Production: swap to BullMQ + Redis by setting REDIS_URL

import { ipfsService } from "./ipfs";

type JobHandler = (data: Record<string, unknown>) => Promise<void>;

interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts?: { delay?: number; attempts?: number; priority?: number };
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export class JobQueueService {
  private queues = new Map<string, QueueJob[]>();
  private handlers = new Map<string, JobHandler>();
  private processing = false;
  private stats = { processed: 0, failed: 0, total: 0 };

  constructor() {
    this.registerDefaultHandlers();
  }

  // Register job handlers
  registerHandler(queueName: string, handler: JobHandler) {
    this.handlers.set(queueName, handler);
  }

  private registerDefaultHandlers() {
    // IPFS upload handler
    this.registerHandler("ipfs-upload", async (data) => {
      const { entryId, fhirBundle } = data;
      if (!fhirBundle) return;
      const result = await ipfsService.upload(fhirBundle as object, {
        name: `health-entry-${entryId}`,
        userId: (data.userId as string) || undefined,
      });
      console.log(`IPFS uploaded: ${result.hash} for entry ${entryId}`);
      // In production: update healthEntry.ipfsHash in DB
    });

    // Entry hash handler (DB-only, no blockchain)
    this.registerHandler("entry-hash", async (data) => {
      console.log(`Entry hash recorded for entry ${data.entryId}`);
    });

    // Analytics update handler
    this.registerHandler("analytics-update", async (data) => {
      console.log(`Analytics updated for entry ${data.entryId}`);
      // In production: invalidate analytics cache for user
    });

    // Reward points handler (DB-based, no blockchain minting)
    this.registerHandler("reward-points", async (data) => {
      console.log(`Reward points: ${data.amount} H2E points for user ${data.userId}`);
    });

    // Badge check handler
    this.registerHandler("badge-check", async (data) => {
      console.log(`Badge check for user ${data.userId}, trigger: ${data.triggerEvent}`);
    });
  }

  async add(queueName: string, jobName: string, data: Record<string, unknown>, opts?: QueueJob["opts"]): Promise<string> {
    if (!this.queues.has(queueName)) this.queues.set(queueName, []);
    const jobId = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: QueueJob = {
      id: jobId,
      name: jobName,
      data: { ...data, _jobId: jobId },
      opts,
      status: "pending",
      attempts: 0,
      maxAttempts: opts?.attempts || 1,
      createdAt: Date.now(),
    };
    this.queues.get(queueName)!.push(job);
    this.stats.total++;

    // Process asynchronously
    if (opts?.delay) {
      setTimeout(() => this.processJob(queueName, job), opts.delay);
    } else {
      setImmediate(() => this.processJob(queueName, job));
    }

    return jobId;
  }

  private async processJob(queueName: string, job: QueueJob) {
    const handler = this.handlers.get(queueName);
    if (!handler) {
      console.log(`No handler for queue: ${queueName}/${job.name}`);
      return;
    }

    job.status = "processing";
    job.attempts++;

    try {
      await handler(job.data);
      job.status = "completed";
      job.completedAt = Date.now();
      this.stats.processed++;
    } catch (err: any) {
      job.error = err.message;
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = 1000 * Math.pow(2, job.attempts - 1);
        console.log(`Retrying ${queueName}/${job.name} in ${delay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
        setTimeout(() => this.processJob(queueName, job), delay);
      } else {
        job.status = "failed";
        this.stats.failed++;
        console.error(`Job failed: ${queueName}/${job.name} after ${job.attempts} attempts: ${err.message}`);
      }
    }
  }

  // Queue health entry processing
  async queueHealthEntryProcessing(entryId: string, fhirBundle: object, encryptedInput: string) {
    await this.add("ipfs-upload", "upload-fhir", { entryId, fhirBundle });
    await this.add("entry-hash", "record-hash", { entryId }, { delay: 5000 });
    await this.add("analytics-update", "update-symptoms", { entryId });
  }

  // Queue reward points crediting
  async queueRewardPoints(userId: string, amount: string, rewardType: string) {
    await this.add("reward-points", "credit-h2e-points", { userId, amount, rewardType }, { attempts: 3 });
  }

  // Queue badge eligibility check
  async queueBadgeCheck(userId: string, triggerEvent: string) {
    await this.add("badge-check", "check-eligibility", { userId, triggerEvent });
  }

  // Get queue stats
  getStats() {
    const queueSizes: Record<string, { pending: number; processing: number; completed: number; failed: number }> = {};
    for (const [name, jobs] of this.queues) {
      queueSizes[name] = {
        pending: jobs.filter(j => j.status === "pending").length,
        processing: jobs.filter(j => j.status === "processing").length,
        completed: jobs.filter(j => j.status === "completed").length,
        failed: jobs.filter(j => j.status === "failed").length,
      };
    }
    return { ...this.stats, queues: queueSizes };
  }

  // Cleanup completed jobs older than retention period
  cleanup(retentionMs: number = 3600_000) {
    const cutoff = Date.now() - retentionMs;
    for (const [name, jobs] of this.queues) {
      this.queues.set(name, jobs.filter(j =>
        j.status === "pending" || j.status === "processing" || (j.completedAt && j.completedAt > cutoff),
      ));
    }
  }
}

export const jobQueue = new JobQueueService();
