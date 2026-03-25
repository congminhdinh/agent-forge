import { AdminModule } from './admin.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from './agent/agent.module';
import { AgentRun } from './agent/agent-run.entity';
import { NotificationRecord } from './notifications/notification.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeModule } from './realtime.module';
import { RealtimeService } from './realtime.service';
import { ApiKeySetting } from './settings/api-key-setting.entity';
import { SettingsModule } from './settings/settings.module';
import { UsageController } from './usage.controller';
import { User } from './users/user.entity';
import { Project } from './workspace/project.entity';
import { AgentRole } from './workspace/role.entity';
import { TaskItem } from './workspace/task.entity';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            autoLoadEntities: true,
            synchronize: true,
          };
        }

        return {
          type: 'sqljs' as const,
          autoLoadEntities: true,
          synchronize: true,
          autoSave: true,
          location: '.agentforge-api.sqlite',
          entities: [
            User,
            ApiKeySetting,
            Project,
            AgentRole,
            TaskItem,
            AgentRun,
            NotificationRecord,
          ],
        };
      },
    }),
    AdminModule,
    AuthModule,
    NotificationsModule,
    RealtimeModule,
    SettingsModule,
    WorkspaceModule,
    AgentModule,
  ],
  controllers: [AppController, RealtimeController, UsageController],
  providers: [AppService],
})
export class AppModule {}
