'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { usersApi } from '@/lib/users-api';
import type { UserFormState } from './_components/user-form';

type ApiError = { error: { code: string; message: string; details?: { fields?: Record<string, string[]> } } };

async function getToken(): Promise<string> {
  const store = await cookies();
  const token = store.get('recafco_access')?.value;
  if (!token) redirect('/login');
  return token;
}

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
      username: result.data.user.username,
      displayName: result.data.user.displayName,
      tempPassword: result.data.tempPassword,
    },
  };
}

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
    if (result.code === 'VALIDATION_ERROR') {
      return { error: result.message };
    }
    return { error: result.message };
  }

  redirect('/administration/users');
}

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
