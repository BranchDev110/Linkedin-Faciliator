import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      request.user = {
        uid: payload.sub,
        email: payload.email,
        name: payload.name,
        emailVerified: true,
      } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  extractBearerToken(authHeader?: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    return token;
  }
}
