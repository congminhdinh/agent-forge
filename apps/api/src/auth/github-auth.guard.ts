import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  override canActivate(context: ExecutionContext) {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured in this environment.',
      );
    }

    return super.canActivate(context);
  }
}
