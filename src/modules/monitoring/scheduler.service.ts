import type { TrackingService } from '../tracking/tracking.service.js';
import type { DueTrackingDto } from '../tracking/tracking.types.js';
import type { MonitoringService } from './monitoring.service.js';

export type SchedulerTrackingService = Pick<
  TrackingService,
  'findDueTrackings'
>;

export type SchedulerMonitoringService = Pick<
  MonitoringService,
  'checkTracking'
>;

export type SchedulerLogger = {
  info(message: string): void;
  error(message: string): void;
};

export class SchedulerService {
  private interval: NodeJS.Timeout | undefined;
  private currentTick: Promise<void> | undefined;

  constructor(
    private readonly trackingService: SchedulerTrackingService,
    private readonly monitoringService: SchedulerMonitoringService,
    private readonly pollMs: number,
    private readonly logger: SchedulerLogger,
  ) {
    if (!Number.isInteger(pollMs) || pollMs <= 0) {
      throw new Error('pollMs must be a positive integer.');
    }
  }

  start(): void {
    if (this.interval) {
      return;
    }

    this.logger.info('Monitoring scheduler started');
    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, this.pollMs);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      this.logger.info('Monitoring scheduler stopped');
    }

    await this.currentTick;
  }

  async tick(now = new Date()): Promise<boolean> {
    if (this.currentTick) {
      return false;
    }

    const currentTick = this.runTick(now).catch((error: unknown) => {
      this.logger.error(
        `Scheduler tick failed: error=${this.getSafeErrorName(error)}`,
      );
    });
    this.currentTick = currentTick;

    try {
      await currentTick;
    } finally {
      if (this.currentTick === currentTick) {
        this.currentTick = undefined;
      }
    }

    return true;
  }

  private async runTick(now: Date): Promise<void> {
    const trackings = await this.trackingService.findDueTrackings(now);

    for (const tracking of trackings) {
      await this.checkTrackingSafely(tracking, now);
    }
  }

  private async checkTrackingSafely(
    tracking: DueTrackingDto,
    checkedAt: Date,
  ): Promise<void> {
    try {
      await this.monitoringService.checkTracking(tracking, checkedAt);
    } catch (error) {
      const channel = tracking.channelUsername
        ? `@${tracking.channelUsername}`
        : tracking.channelId;

      this.logger.error(
        `Tracking check failed: trackingId=${this.getSafeIdentifier(tracking.id)} channel=${this.getSafeIdentifier(channel)} error=${this.getSafeErrorName(error)}`,
      );
    }
  }

  private getSafeErrorName(error: unknown): string {
    return error instanceof Error
      ? this.getSafeIdentifier(error.name)
      : 'unknown';
  }

  private getSafeIdentifier(value: string): string {
    return value.replace(/[^A-Za-z0-9_@.-]/g, '_').slice(0, 100);
  }
}
