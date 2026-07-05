'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { usersApi } from '@/lib/users-api';
import type { ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import type { UserFormState } from './_components/user-form';

type ApiError = { error: { code: string; message: string; details?: { fields?: Record<string, string[]> } } };

async function getToken(): Promise<string> {
  const store = await cookies();
  const token = store.get('recafco_access')?.value;
  if (!token) redirect('/login');
  return token;
}

// ---------------------------------------------------------------------------
// Create user (basic, used by legacy UserForm)
// ---------------------------------------------------------------------------

export async function createUserAction(
  _prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  const accessToken = await getToken();

  const username = formData.get('username')?.toString().trim() ?? '';
  const displayName = formData.get('displayName')?.toString().trim() ?? '';
  const emailRaw = formData.get('email')?.toString().trim();
  const employeeNumberRaw = formData.get('employeeNumber')?.toString().trim();
  const roleIdRaw = formData.get('roleId')?.toString().trim();
  const departmentIdRaw = formData.get('departmentId')?.toString().trim();
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const locationIdRaw = formData.get('locationId')?.toString().trim();

  const payload = {
    username,
    displayName,
    ...(roleIdRaw ? { roleId: roleIdRaw } : {}),
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(employeeNumberRaw ? { employeeNumber: employeeNumberRaw } : {}),
    ...(departmentIdRaw ? { departmentId: departmentIdRaw } : {}),
    ...(plantIdRaw ? { plantId: plantIdRaw } : {}),
    ...(locationIdRaw ? { locationId: locationIdRaw } : {}),
  };

  const result = await usersApi.create(accessToken, payload);
  if (!result.ok) {
    const body = result as unknown as ApiError;
    if (result.code === 'VALIDATION_ERROR') {
      return { fieldErrors: (body as unknown as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {} };
    }
    return { error: result.message };
  }

  return {
    created: {
      id: result.data.user.id,
      username: result.data.user.username,
      displayName: result.data.user.displayName,
      tempPassword: result.data.tempPassword,
    },
  };
}

// ---------------------------------------------------------------------------
// Create user with module access (used by NewUserForm)
// ---------------------------------------------------------------------------

export type CreateWithAccessState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  created?: {
    id: string;
    username: string;
    displayName: string;
    tempPassword: string;
    accessFailures?: { module: string; error: string }[];
  };
} | null;

const ALL_MODULES: ModuleIdentifier[] = [
  'FACTORY_TASKS',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT',
  'PRODUCTION_DASHBOARD',
  'ADMINISTRATION',
];

export async function createUserWithAccessAction(
  _prev: CreateWithAccessState,
  formData: FormData,
): Promise<CreateWithAccessState> {
  const accessToken = await getToken();

  const username = formData.get('username')?.toString().trim() ?? '';
  const displayName = formData.get('displayName')?.toString().trim() ?? '';
  const emailRaw = formData.get('email')?.toString().trim();
  const employeeNumberRaw = formData.get('employeeNumber')?.toString().trim();
  const roleIdRaw = formData.get('roleId')?.toString().trim();
  const departmentIdRaw = formData.get('departmentId')?.toString().trim();
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const locationIdRaw = formData.get('locationId')?.toString().trim();

  const payload = {
    username,
    displayName,
    ...(roleIdRaw ? { roleId: roleIdRaw } : {}),
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(employeeNumberRaw ? { employeeNumber: employeeNumberRaw } : {}),
    ...(departmentIdRaw ? { departmentId: departmentIdRaw } : {}),
    ...(plantIdRaw ? { plantId: plantIdRaw } : {}),
    ...(locationIdRaw ? { locationId: locationIdRaw } : {}),
  };

  const result = await usersApi.create(accessToken, payload);
  if (!result.ok) {
    if (result.code === 'VALIDATION_ERROR') {
      return { fieldErrors: {} };
    }
    return { error: result.message };
  }

  const userId = result.data.user.id;

  // Apply non-default module access scopes.
  const accessFailures: { module: string; error: string }[] = [];
  for (const mod of ALL_MODULES) {
    const scopeVal = formData.get(`module_scope_${mod}`)?.toString() as DepartmentAccessScope | undefined;
    if (!scopeVal || scopeVal === 'OWN_DEPARTMENT') continue;

    const deptIds = formData
      .getAll(`module_depts_${mod}`)
      .map((v) => v.toString())
      .filter(Boolean);

    const accessResult = await usersApi.setModuleAccess(accessToken, userId, mod, {
      scope: scopeVal,
      ...(deptIds.length > 0 ? { departmentIds: deptIds } : {}),
    });

    if (!accessResult.ok) {
      accessFailures.push({ module: mod, error: accessResult.message });
    }
  }

  return {
    created: {
      id: userId,
      username: result.data.user.username,
      displayName: result.data.user.displayName,
      tempPassword: result.data.tempPassword,
      ...(accessFailures.length > 0 ? { accessFailures } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Update user profile (display name, email, employee number)
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  id: string,
  _prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  const accessToken = await getToken();

  const displayName = formData.get('displayName')?.toString().trim() ?? '';
  const emailRaw = formData.get('email')?.toString().trim();
  const employeeNumberRaw = formData.get('employeeNumber')?.toString().trim();

  const payload = {
    displayName,
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(employeeNumberRaw ? { employeeNumber: employeeNumberRaw } : {}),
  };

  const result = await usersApi.update(accessToken, id, payload);
  if (!result.ok) return { error: result.message };

  revalidatePath(`/administration/users/${id}/edit`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update user org assignment (department, plant, location)
// ---------------------------------------------------------------------------

export async function updateOrgAction(
  id: string,
  _prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  const accessToken = await getToken();

  const departmentIdRaw = formData.get('departmentId')?.toString().trim();
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const locationIdRaw = formData.get('locationId')?.toString().trim();

  // Empty string means the user selected "— None —" — send null to explicitly clear the field.
  const payload = {
    departmentId: departmentIdRaw || null,
    plantId: plantIdRaw || null,
    locationId: locationIdRaw || null,
  };

  const result = await usersApi.update(accessToken, id, payload);
  if (!result.ok) return { error: result.message };

  revalidatePath(`/administration/users/${id}/edit`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Assign role
// ---------------------------------------------------------------------------

export async function assignRoleAction(
  id: string,
  _prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  const accessToken = await getToken();

  const roleId = formData.get('roleId')?.toString().trim() ?? '';
  if (!roleId) return { error: 'Role is required' };

  const result = await usersApi.assignRole(accessToken, id, roleId);
  if (!result.ok) return { error: result.message };

  revalidatePath(`/administration/users/${id}/edit`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Update user (legacy flat form — kept for backward compatibility)
// ---------------------------------------------------------------------------

export async function updateUserAction(
  id: string,
  _prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  const accessToken = await getToken();

  const displayName = formData.get('displayName')?.toString().trim() ?? '';
  const emailRaw = formData.get('email')?.toString().trim();
  const employeeNumberRaw = formData.get('employeeNumber')?.toString().trim();
  const departmentIdRaw = formData.get('departmentId')?.toString().trim();
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const locationIdRaw = formData.get('locationId')?.toString().trim();

  const payload = {
    displayName,
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(employeeNumberRaw ? { employeeNumber: employeeNumberRaw } : {}),
    ...(departmentIdRaw ? { departmentId: departmentIdRaw } : {}),
    ...(plantIdRaw ? { plantId: plantIdRaw } : {}),
    ...(locationIdRaw ? { locationId: locationIdRaw } : {}),
  };

  const result = await usersApi.update(accessToken, id, payload);
  if (!result.ok) {
    return { error: result.message };
  }

  redirect('/administration/users');
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function resetPasswordAction(
  id: string,
  prev: UserFormState | null,
  formData: FormData,
): Promise<UserFormState | null> {
  void prev;
  void formData;
  const accessToken = await getToken();

  const userResult = await usersApi.get(accessToken, id);
  const username = userResult.ok ? userResult.data.username : id;

  const result = await usersApi.resetPassword(accessToken, id);
  if (!result.ok) {
    return { error: result.message };
  }

  return { passwordReset: { username, tempPassword: result.data.tempPassword } };
}

// ---------------------------------------------------------------------------
// Activate / Deactivate / Unlock
// ---------------------------------------------------------------------------

export async function deactivateUserAction(id: string): Promise<void> {
  const accessToken = await getToken();
  await usersApi.deactivate(accessToken, id);
  redirect('/administration/users');
}

export async function activateUserAction(id: string): Promise<void> {
  const accessToken = await getToken();
  await usersApi.activate(accessToken, id);
  redirect('/administration/users');
}

export async function unlockUserAction(id: string): Promise<void> {
  const accessToken = await getToken();
  await usersApi.unlock(accessToken, id);
  redirect(`/administration/users/${id}/edit`);
}

export type UserLifecycleActionResult = { error?: string };

export async function archiveUserAction(id: string): Promise<UserLifecycleActionResult> {
  const accessToken = await getToken();
  const result = await usersApi.archive(accessToken, id);
  if (!result.ok) return { error: result.message };
  revalidatePath('/administration/users');
  return {};
}

export async function deleteTestUserAction(
  id: string,
  confirmationText: string,
): Promise<UserLifecycleActionResult> {
  const accessToken = await getToken();
  const result = await usersApi.deleteTestUser(accessToken, id, confirmationText);
  if (!result.ok) return { error: result.message };
  revalidatePath('/administration/users');
  return {};
}

// ---------------------------------------------------------------------------
// Module access
// ---------------------------------------------------------------------------

export type ModuleAccessActionState = { error?: string; success?: boolean } | null;

export async function setModuleAccessAction(
  userId: string,
  module: ModuleIdentifier,
  _prev: ModuleAccessActionState,
  formData: FormData,
): Promise<ModuleAccessActionState> {
  const accessToken = await getToken();
  const scope = formData.get('scope')?.toString() as DepartmentAccessScope | undefined;
  if (!scope) return { error: 'Scope is required' };

  const rawDeptIds = formData.getAll('departmentIds');
  const departmentIds = rawDeptIds.map((v) => v.toString()).filter(Boolean);

  const result = await usersApi.setModuleAccess(accessToken, userId, module, {
    scope,
    ...(departmentIds.length > 0 ? { departmentIds } : {}),
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath(`/administration/users/${userId}/edit`);
  return { success: true };
}
