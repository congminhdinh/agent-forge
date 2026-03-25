import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookNotificationsEnabled?: boolean;

  @IsOptional()
  @IsEmail()
  notificationEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notificationWebhookUrl?: string | null;
}
