import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RealtimeService } from '../realtime.service';
import { User } from '../users/user.entity';
import { NotificationRecord } from './notification.entity';
import { UpdateNotificationPreferencesDto } from './notifications.dto';

type NotifyPayload = {
  kind: string;
  level: string;
  title: string;
  message: string;
  taskId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationRecord)
    private readonly notificationsRepository: Repository<NotificationRecord>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
  ) {}

  async listNotifications(user: User) {
    const notifications = await this.notificationsRepository.find({
      where: { user: { id: user.id } },
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return notifications.map((notification) => this.serialize(notification));
  }

  getPreferences(user: User) {
    return this.serializePreferences(user);
  }

  async updatePreferences(user: User, body: UpdateNotificationPreferencesDto) {
    const persisted = await this.usersRepository.findOneByOrFail({ id: user.id });
    if (body.emailNotificationsEnabled !== undefined) {
      persisted.emailNotificationsEnabled = body.emailNotificationsEnabled;
    }
    if (body.webhookNotificationsEnabled !== undefined) {
      persisted.webhookNotificationsEnabled = body.webhookNotificationsEnabled;
    }
    if (body.notificationEmail !== undefined) {
      persisted.notificationEmail = body.notificationEmail?.trim() || null;
    }
    if (body.notificationWebhookUrl !== undefined) {
      persisted.notificationWebhookUrl =
        body.notificationWebhookUrl?.trim() || null;
    }

    const saved = await this.usersRepository.save(persisted);
    return this.serializePreferences(saved);
  }

  async markRead(user: User, notificationId: string) {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, user: { id: user.id } },
      relations: { user: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    notification.readAt = notification.readAt ?? new Date();
    await this.notificationsRepository.save(notification);
    this.realtimeService.emitNotifications(user.id, 'notification_read', {
      notificationId,
    });
    return this.listNotifications(user);
  }

  async markAllRead(user: User) {
    const notifications = await this.notificationsRepository.find({
      where: { user: { id: user.id } },
      relations: { user: true },
    });
    const unread = notifications.filter((notification) => !notification.readAt);
    if (unread.length > 0) {
      unread.forEach((notification) => {
        notification.readAt = new Date();
      });
      await this.notificationsRepository.save(unread);
    }

    this.realtimeService.emitNotifications(user.id, 'notifications_cleared', {
      count: unread.length,
    });
    return this.listNotifications(user);
  }

  async notifyUser(userId: string, payload: NotifyPayload) {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    const persisted: NotificationRecord[] = [];

    persisted.push(
      await this.saveNotification(user, {
        ...payload,
        channel: 'in_app',
        status: 'sent',
        destination: null,
        deliveredAt: new Date(),
        error: null,
      }),
    );

    if (user.emailNotificationsEnabled && user.notificationEmail) {
      persisted.push(
        await this.saveNotification(user, {
          ...payload,
          channel: 'email',
          status: 'skipped',
          destination: user.notificationEmail,
          deliveredAt: null,
          error:
            'Email delivery is not configured in this environment. The notification was stored in-app instead.',
        }),
      );
    }

    if (user.webhookNotificationsEnabled && user.notificationWebhookUrl) {
      persisted.push(
        await this.deliverWebhook(user, payload, user.notificationWebhookUrl),
      );
    }

    this.realtimeService.emitNotifications(user.id, 'notification_created', {
      kind: payload.kind,
      level: payload.level,
    });
    return persisted.map((notification) => this.serialize(notification));
  }

  private async deliverWebhook(
    user: User,
    payload: NotifyPayload,
    destination: string,
  ) {
    try {
      const response = await fetch(destination, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-agentforge-notification': payload.kind,
        },
        body: JSON.stringify({
          userId: user.id,
          ...payload,
          createdAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return this.saveNotification(user, {
          ...payload,
          channel: 'webhook',
          status: 'failed',
          destination,
          deliveredAt: null,
          error: `Webhook responded with ${response.status}.`,
        });
      }

      return this.saveNotification(user, {
        ...payload,
        channel: 'webhook',
        status: 'sent',
        destination,
        deliveredAt: new Date(),
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown webhook delivery error';
      this.logger.warn(
        JSON.stringify({
          event: 'notification.webhook_failed',
          userId: user.id,
          destination,
          reason: message,
        }),
      );
      return this.saveNotification(user, {
        ...payload,
        channel: 'webhook',
        status: 'failed',
        destination,
        deliveredAt: null,
        error: message,
      });
    }
  }

  private async saveNotification(
    user: User,
    payload: NotifyPayload & {
      channel: string;
      status: string;
      destination: string | null;
      deliveredAt: Date | null;
      error: string | null;
    },
  ) {
    const notification = this.notificationsRepository.create({
      user,
      kind: payload.kind,
      channel: payload.channel,
      level: payload.level,
      title: payload.title,
      message: payload.message,
      taskId: payload.taskId ?? null,
      projectId: payload.projectId ?? null,
      status: payload.status,
      destination: payload.destination,
      deliveredAt: payload.deliveredAt,
      metadata: payload.metadata ?? null,
      error: payload.error,
      readAt: null,
    });
    return this.notificationsRepository.save(notification);
  }

  private serialize(notification: NotificationRecord) {
    return {
      id: notification.id,
      kind: notification.kind,
      channel: notification.channel,
      level: notification.level,
      title: notification.title,
      message: notification.message,
      taskId: notification.taskId,
      projectId: notification.projectId,
      status: notification.status,
      destination: notification.destination,
      metadata: notification.metadata,
      error: notification.error,
      readAt: notification.readAt,
      deliveredAt: notification.deliveredAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  private serializePreferences(user: User) {
    return {
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      webhookNotificationsEnabled: user.webhookNotificationsEnabled,
      notificationEmail: user.notificationEmail,
      notificationWebhookUrl: user.notificationWebhookUrl,
    };
  }
}
