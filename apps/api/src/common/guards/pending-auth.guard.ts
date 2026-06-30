import { Injectable, CanActivate, ServiceUnavailableException } from '@nestjs/common';
import { getApiEnv } from '../../env';

/**
 * Blocks mutation endpoints in production until real authentication is implemented.
 * In development/test environments, requests pass through unconditionally.
 * Apply to every non-idempotent handler: POST (create), PATCH, DELETE.
 */
@Injectable()
export class PendingAuthGuard implements CanActivate {
  canActivate(): boolean {
    const { nodeEnv } = getApiEnv();
    if (nodeEnv === 'production') {
      throw new ServiceUnavailableException({
        code: 'AUTH_NOT_IMPLEMENTED',
        message:
          'This endpoint requires authentication. Authentication has not yet been implemented for production use.',
      });
    }
    return true;
  }
}
