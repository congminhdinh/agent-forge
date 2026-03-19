import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../users/user.entity';
import { CurrentUser } from './current-user.decorator';
import { DevLoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { GithubAuthGuard } from './github-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  devLogin(@Body() body: DevLoginDto) {
    return this.authService.devLogin(body.email, body.displayName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  getSession(@CurrentUser() user: User) {
    return this.authService.getSession(user.id);
  }

  @UseGuards(GithubAuthGuard)
  @Get('github')
  githubAuth() {
    return;
  }

  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  githubCallback(@Req() req: Request & { user: User }) {
    return this.authService.buildAuthResponse(req.user);
  }
}
