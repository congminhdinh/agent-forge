import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import {
  CreateRoleDto,
  ImportRoleTemplatesDto,
  UpdateRoleDto,
} from './workspace.dto';
import { WorkspaceService } from './workspace.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class RolesController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('projects/:projectId/roles')
  listRoles(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.workspaceService.listRoles(user, projectId);
  }

  @Get('role-templates/library')
  listRoleTemplateLibrary() {
    return this.workspaceService.listRoleTemplateLibrary();
  }

  @Get('projects/:projectId/roles/export')
  exportRoleTemplates(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
  ) {
    return this.workspaceService.exportRoleTemplates(user, projectId);
  }

  @Post('projects/:projectId/roles')
  createRole(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() body: CreateRoleDto,
  ) {
    return this.workspaceService.createRole(user, projectId, body);
  }

  @Post('projects/:projectId/roles/import')
  importRoleTemplates(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() body: ImportRoleTemplatesDto,
  ) {
    return this.workspaceService.importRoleTemplates(user, projectId, body);
  }

  @Patch('roles/:roleId')
  updateRole(
    @CurrentUser() user: User,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.workspaceService.updateRole(user, roleId, body);
  }

  @Delete('roles/:roleId')
  deleteRole(@CurrentUser() user: User, @Param('roleId') roleId: string) {
    return this.workspaceService.deleteRole(user, roleId);
  }
}
