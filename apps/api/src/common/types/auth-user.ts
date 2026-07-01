export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
  isActive: boolean;
  sessionId: string;
}
