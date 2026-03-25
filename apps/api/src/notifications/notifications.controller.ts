import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { UpdateNotificationPreferencesDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(@CurrentUser() user: User) {
    return this.notificationsService.listNotifications(user);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: User) {
    return this.notificationsService.getPreferences(user);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: User,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user, body);
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: User,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(user, notificationId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user);
  }
}
