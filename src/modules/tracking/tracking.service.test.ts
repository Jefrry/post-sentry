import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DomainError } from '../common/domainError.js';
import { TrackingService } from './tracking.service.js';

describe('TrackingService.parseIntervalHours', () => {
  const service = new TrackingService();

  const validIntervals = [1, 3, 6, 12, 24] as const;

  for (const interval of validIntervals) {
    it(`accepts ${interval}`, () => {
      assert.equal(service.parseIntervalHours(interval), interval);
    });
  }

  const invalidIntervals = [0, 2, 5, 25, 1.5] as const;

  for (const interval of invalidIntervals) {
    it(`rejects ${interval}`, () => {
      assert.throws(() => service.parseIntervalHours(interval), DomainError);
    });
  }
});
