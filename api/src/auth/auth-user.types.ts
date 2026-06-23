export type UserRole = 'user' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  role: UserRole;
  status: UserStatus;
}
