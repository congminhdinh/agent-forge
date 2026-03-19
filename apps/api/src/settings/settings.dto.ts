import { IsIn, IsString, MinLength } from 'class-validator';

export class UpsertApiKeyDto {
  @IsString()
  @MinLength(10)
  apiKey!: string;
}

export class ProviderParamDto {
  @IsString()
  @IsIn(['openai', 'anthropic'])
  provider!: 'openai' | 'anthropic';
}
