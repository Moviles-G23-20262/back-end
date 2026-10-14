import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { SmartAlertsService } from './smart-alerts.service';
import { CreateSmartAlertDto } from './dto/create-smart-alert.dto';
import { UpdateSmartAlertDto } from './dto/update-smart-alert.dto';
import { Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('smart-alerts')
export class SmartAlertsController {
  constructor(private readonly smartAlertsService: SmartAlertsService) {}

  @Post()
  create(@Body() createSmartAlertDto: CreateSmartAlertDto, @Auth() auth: AuthContext) {
    return this.smartAlertsService.create(createSmartAlertDto, auth);
  }

  @Get()
  findAll(@Auth() auth: AuthContext) {
    return this.smartAlertsService.findAll(auth);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSmartAlertDto: UpdateSmartAlertDto,
    @Auth() auth: AuthContext,
  ) {
    return this.smartAlertsService.update(id, updateSmartAlertDto, auth);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.smartAlertsService.remove(id, auth);
  }
}
