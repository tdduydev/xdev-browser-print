import type { JobState, PrintJobRecord } from '@xdev/shared-types';
import { TERMINAL_JOB_STATES } from '@xdev/shared-types';

const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  CREATED: ['VALIDATING', 'FAILED', 'CANCELLED'],
  VALIDATING: ['WAITING_PERMISSION', 'QUEUED', 'FAILED', 'CANCELLED'],
  WAITING_PERMISSION: ['QUEUED', 'FAILED', 'CANCELLED'],
  QUEUED: ['DISPATCHING', 'FAILED', 'CANCELLED'],
  // DISPATCHING → QUEUED only for a retry when we know no byte reached the device.
  DISPATCHING: ['SUBMITTED', 'FAILED', 'UNKNOWN', 'QUEUED'],
  SUBMITTED: [],
  FAILED: [],
  CANCELLED: [],
  UNKNOWN: [],
};

export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(state: JobState): boolean {
  return TERMINAL_JOB_STATES.includes(state);
}

export function transition(job: PrintJobRecord, to: JobState, patch: Partial<PrintJobRecord> = {}, now = Date.now()): PrintJobRecord {
  if (!canTransition(job.state, to)) {
    throw new Error(`Illegal job transition ${job.state} → ${to}`);
  }
  return { ...job, ...patch, state: to, updatedAt: now, history: [...job.history, { state: to, at: now }] };
}

/**
 * After a service-worker restart: QUEUED jobs never touched a device and may resume;
 * DISPATCHING jobs may or may not have printed, so they become UNKNOWN and are never
 * re-sent automatically (duplicate prescriptions/labels are worse than a missing one).
 */
export function recoverAfterRestart(job: PrintJobRecord, now = Date.now()): { job: PrintJobRecord; resume: boolean } {
  switch (job.state) {
    case 'CREATED':
    case 'VALIDATING':
    case 'WAITING_PERMISSION':
      return { job: transition(job, job.state === 'WAITING_PERMISSION' ? 'CANCELLED' : 'FAILED', { outcome: 'INTERRUPTED_BY_RESTART' }, now), resume: false };
    case 'QUEUED':
      return { job, resume: true };
    case 'DISPATCHING':
      return {
        job: transition(job, 'UNKNOWN', { outcome: 'INTERRUPTED_DURING_DISPATCH' }, now),
        resume: false,
      };
    default:
      return { job, resume: false };
  }
}
