import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TASK_STATUSES } from './workspace.types';

export class CreateProjectDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  githubRepo?: string;

  @IsString()
  @IsOptional()
  githubBranchPrefix?: string;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  githubRepo?: string | null;

  @IsString()
  @IsOptional()
  githubBranchPrefix?: string;
}

export class CreateRoleDto {
  @IsString()
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MaxLength(80)
  displayName!: string;

  @IsString()
  systemPromptTemplate!: string;

  @IsString()
  modelPreference!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toolAccessPolicy?: string[];
}

export class RoleTemplateDto {
  @IsString()
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MaxLength(80)
  displayName!: string;

  @IsString()
  systemPromptTemplate!: string;

  @IsString()
  modelPreference!: string;

  @IsArray()
  @IsString({ each: true })
  toolAccessPolicy!: string[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  displayName?: string;

  @IsString()
  @IsOptional()
  systemPromptTemplate?: string;

  @IsString()
  @IsOptional()
  modelPreference?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toolAccessPolicy?: string[];
}

export class CreateTaskDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  assignedRoleId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  modelOverride?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(140)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  assignedRoleId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  modelOverride?: string | null;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];
}

export class ImportRoleTemplatesDto {
  @IsArray()
  roles!: RoleTemplateDto[];

  @IsOptional()
  @IsIn(['merge', 'replace_existing'])
  mode?: 'merge' | 'replace_existing';
}

export class BootstrapSampleProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SubmitReviewDto {
  @IsIn(['approve', 'request_changes', 'reject'])
  action!: 'approve' | 'request_changes' | 'reject';

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  comment?: string;

  @IsString()
  @IsOptional()
  targetRoleSlug?: string;
}
