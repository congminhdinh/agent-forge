import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DevLoginDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  displayName?: string;
}
