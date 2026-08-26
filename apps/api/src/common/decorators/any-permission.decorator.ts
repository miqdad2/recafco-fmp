import { SetMetadata } from '@nestjs/common';

// Additive alongside @Permissions (AND semantics, unchanged). @AnyPermission
// grants access if the actor has AT LEAST ONE of the listed codes — used
// where a broader "manager" permission and a narrower "staff" permission
// should both unlock the same route, with fine-grained scoping (e.g. "only
// your own assigned records") left to the service layer. See CM-35.
export const ANY_PERMISSION_KEY = 'anyPermission';
export const AnyPermission = (...codes: string[]) => SetMetadata(ANY_PERMISSION_KEY, codes);
