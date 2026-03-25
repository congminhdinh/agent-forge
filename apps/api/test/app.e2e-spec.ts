import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Phase 3 workflow (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    const databaseFile = join(process.cwd(), '.agentforge-api.sqlite');
    if (existsSync(databaseFile)) {
      rmSync(databaseFile, { force: true });
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('boots the starter workspace and exposes the phase 3 operations surface', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({
        email: 'phase3.tester@agentforge.local',
        displayName: 'Phase 3 Tester',
      })
      .expect(201);

    token = login.body.accessToken;
    userId = login.body.user.id;
    expect(login.body.user.isAdmin).toBe(true);
    expect(login.body.user.onboardingCompleted).toBe(false);

    const bootstrap = await request(app.getHttpServer())
      .post('/projects/bootstrap-sample')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    projectId = bootstrap.body.id;
    taskId = bootstrap.body.tasks[0].id;
    expect(bootstrap.body.roles.length).toBeGreaterThanOrEqual(5);
    expect(bootstrap.body.tasks.length).toBe(3);

    const library = await request(app.getHttpServer())
      .get('/role-templates/library')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(library.body)).toBe(true);
    expect(library.body.some((entry: { slug: string }) => entry.slug === 'docs-writer')).toBe(true);

    const exported = await request(app.getHttpServer())
      .get(`/projects/${projectId}/roles/export`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(exported.body.roles.length).toBeGreaterThanOrEqual(5);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/roles/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'replace_existing',
        roles: [
          {
            slug: 'delivery-manager',
            displayName: 'Delivery Manager',
            systemPromptTemplate: 'Summarize release readiness.',
            modelPreference: 'anthropic:claude-3-5-haiku-latest',
            toolAccessPolicy: ['github_read'],
          },
        ],
      })
      .expect(201);

    const dispatched = await request(app.getHttpServer())
      .post(`/tasks/${taskId}/dispatch`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(dispatched.body.status).toBe('needs_review');
    expect(dispatched.body.messages.length).toBeGreaterThan(0);

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      notifications.body.some(
        (entry: { kind: string }) => entry.kind === 'review_requested',
      ),
    ).toBe(true);

    const usage = await request(app.getHttpServer())
      .get('/subscriptions/me/usage')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(usage.body.weekly_cost_usd).toBeGreaterThanOrEqual(0);
    expect(usage.body.weekly_tokens).toBeGreaterThan(0);
    expect(usage.body.recent_sessions.length).toBeGreaterThan(0);

    const adminUsers = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(adminUsers.body[0].id).toBe(userId);

    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxConcurrentSessions: 7 })
      .expect(200);

    const stats = await request(app.getHttpServer())
      .get('/admin/system/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(stats.body.queue.mode).toBe('local_fallback');
    expect(stats.body.users).toBe(1);

    await request(app.getHttpServer())
      .post(`/tasks/${taskId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: 'reject',
        comment: 'Rejecting to validate retry.',
      })
      .expect(201);

    const retry = await request(app.getHttpServer())
      .post(`/tasks/${taskId}/retry`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(retry.body.status).toBe('needs_review');
  });
});
