import { DomainError } from '../common/domainError.js';
import type { ChannelReaderErrorCode } from './channel.types.js';

export class ChannelReaderError extends DomainError {
  constructor(
    readonly code: ChannelReaderErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ChannelReaderError';
  }
}
