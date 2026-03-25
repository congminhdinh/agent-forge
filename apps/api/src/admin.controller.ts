import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from './auth/current-user.decorator';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { User } from './users/user.entity';
import { AdminGuard } from './admin.guard';
import { UpdateAdminUserDto } from './admin.dto';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@CurrentUser() _user: User) {
    return this.adminService.listUsers();
  }

  @Patch('users/:userId')
  updateUser(@Param('userId') userId: string, @Body() body: UpdateAdminUserDto) {
    return this.adminService.updateUser(userId, body);
  }

  @Get('system/stats')
  getSystemStats(@CurrentUser() _user: User) {
    return this.adminService.getSystemStats();
  }
}
