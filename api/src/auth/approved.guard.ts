import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from './auth-user.types';

@Injectable()
export class ApprovedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === 'admin' || user.status === 'approved') {
      return true;
    }

    if (user.status === 'rejected') {
      throw new ForbiddenException('Your account was not approved');
    }

    throw new ForbiddenException('Your account is pending admin approval');
  }
}
