import { DomainError } from '../common/domainError.js';

export class TrackingAlreadyExistsError extends DomainError {
  constructor() {
    super('Этот канал уже отслеживается.');
    this.name = 'TrackingAlreadyExistsError';
  }
}
