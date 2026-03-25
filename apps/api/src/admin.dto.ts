import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsIn(['free', 'pro', 'team'])
  subscriptionTier?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  subscriptionStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxWeeklyTasks?: number;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
