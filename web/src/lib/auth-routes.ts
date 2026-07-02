import { AuthUser } from '../types';

export function getHomePathForUser(user: AuthUser, fromExtension = false): string {
  if (user.status !== 'approved' && user.role !== 'admin') {
    return '/pending';
  }

  if (fromExtension) {
    return '/profiles';
  }

  return '/dashboard';
}
