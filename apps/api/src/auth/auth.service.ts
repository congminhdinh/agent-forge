import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from 'passport-github2';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async devLogin(email?: string, displayName?: string) {
    const normalizedEmail = (email ?? 'demo@agentforge.local').toLowerCase();
    const normalizedName = displayName?.trim() || 'Demo User';
    const existingUsers = await this.usersRepository.count();
    let user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = this.usersRepository.create({
        email: normalizedEmail,
        displayName: normalizedName,
        authProvider: 'dev',
        externalId: null,
        isAdmin: existingUsers === 0,
      });
    } else if (displayName) {
      user.displayName = normalizedName;
    }

    const savedUser = await this.usersRepository.save(user);
    return this.buildAuthResponse(savedUser);
  }

  async getSession(userId: string) {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    return this.buildAuthResponse(user);
  }

  async findOrCreateGithubUser(profile: Profile) {
    const primaryEmail = profile.emails?.[0]?.value;
    const email = primaryEmail ?? `${profile.username}@users.noreply.github.com`;
    let user = await this.usersRepository.findOne({
      where: [
        { email: email.toLowerCase() },
        { authProvider: 'github', externalId: profile.id },
      ],
    });

    if (!user) {
      user = this.usersRepository.create({
        email: email.toLowerCase(),
        displayName: profile.displayName || profile.username || 'GitHub User',
        authProvider: 'github',
        externalId: profile.id,
        isAdmin: false,
      });
    } else {
      user.displayName =
        profile.displayName || profile.username || user.displayName;
      user.externalId = profile.id;
      user.authProvider = 'github';
    }

    return this.usersRepository.save(user);
  }

  buildAuthResponse(user: User) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      authProvider: user.authProvider,
    });

    return {
      accessToken,
      githubConfigured: this.isGithubConfigured(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        authProvider: user.authProvider,
        isAdmin: user.isAdmin,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  isGithubConfigured() {
    return Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
    );
  }
}
