import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'agent-forge-api',
      storageMode: process.env.DATABASE_URL ? 'postgres' : 'sqljs',
      queueMode: process.env.REDIS_URL ? 'bullmq' : 'inline',
      githubAuthConfigured: Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      ),
      timestamp: new Date().toISOString(),
    };
  }
}
