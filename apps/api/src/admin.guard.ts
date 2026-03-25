import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { isAdmin?: boolean } }>();
    if (!request.user?.isAdmin) {
      throw new ForbiddenException('Admin access is required for this route.');
    }

    return true;
  }
}
