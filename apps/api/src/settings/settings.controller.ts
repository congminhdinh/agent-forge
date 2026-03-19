import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { ProviderParamDto, UpsertApiKeyDto } from './settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings/api-keys')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  listApiKeys(@CurrentUser() user: User) {
    return this.settingsService.listApiKeys(user);
  }

  @Put(':provider')
  upsertApiKey(
    @CurrentUser() user: User,
    @Param() params: ProviderParamDto,
    @Body() body: UpsertApiKeyDto,
  ) {
    return this.settingsService.upsertApiKey(user, params.provider, body.apiKey);
  }

  @Delete(':provider')
  removeApiKey(@CurrentUser() user: User, @Param() params: ProviderParamDto) {
    return this.settingsService.removeApiKey(user, params.provider);
  }
}
