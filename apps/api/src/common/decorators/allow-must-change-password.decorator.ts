import { SetMetadata } from '@nestjs/common';

export const ALLOW_MUST_CHANGE_PASSWORD_KEY = 'allowMustChangePassword';

// Marks an endpoint as accessible to users whose mustChangePassword is true.
// Without this decorator, JwtAuthGuard blocks such users with 403 MUST_CHANGE_PASSWORD.
export const AllowMustChangePassword = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_MUST_CHANGE_PASSWORD_KEY, true);
