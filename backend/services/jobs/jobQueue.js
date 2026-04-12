// Phase 9: Async Job Queue
// Non-blocking task processing with status tracking

/**
 * Job states: PENDING → PROCESSING → COMPLETED/FAILED
 */
class JobQueue {
  constructor(options = {}) {
    this.jobs = new Map();
    this.jobIdCounter = 0;
    this.maxConcurrency = options.maxConcurrency || 5;
    this.processing = 0;
    this.resultTTL = options.resultTTL || 3600000; // 1 hour
  }

  /**
   * Submit a job to the queue
   */
  submit(task, priority = 'normal') {
    const jobId = ++this.jobIdCounter;
    const job = {
      id: jobId,
      task,
      priority,
      status: 'PENDING',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      progress: 0,
      result: null,
      error: null
    };

    this.jobs.set(jobId, job);
    this.process();

    return jobId;
  }

  /**
   * Process jobs in queue
   */
  async process() {
    // Limit concurrent processing
    if (this.processing >= this.maxConcurrency) return;

    // Get next job (by priority)
    const sortedJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'PENDING')
      .sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return (priorityOrder[b.priority] - priorityOrder[a.priority]) ||
               (a.createdAt - b.createdAt);
      });

    if (sortedJobs.length === 0) return;

    const job = sortedJobs[0];
    this.processing++;
    job.status = 'PROCESSING';
    job.startedAt = Date.now();

    try {
      console.log(`▶️ Job #${job.id} started (${job.task.type})`);
      
      job.result = await job.task.execute((progress) => {
        job.progress = progress;
      });

      job.status = 'COMPLETED';
      console.log(`✅ Job #${job.id} completed`);

      // Auto-cleanup after TTL
      setTimeout(() => {
        this.jobs.delete(job.id);
      }, this.resultTTL);
    } catch (error) {
      job.status = 'FAILED';
      job.error = error.message;
      console.error(`❌ Job #${job.id} failed:`, error.message);
    } finally {
      job.completedAt = Date.now();
      this.processing--;
      this.process(); // Process next job
    }
  }

  /**
   * Get job status
   */
  getStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    };
  }

  /**
   * Cancel a pending job
   */
  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'PENDING') {
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Get queue stats
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'PENDING').length,
      processing: this.processing,
      completed: jobs.filter(j => j.status === 'COMPLETED').length,
      failed: jobs.filter(j => j.status === 'FAILED').length
    };
  }
}

module.exports = { JobQueue };
