import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { FindMaterialsQueryDto } from './dto/find-materials-query.dto';
import { Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  create(@Body() createMaterialDto: CreateMaterialDto, @Auth() auth: AuthContext) {
    return this.materialsService.create(createMaterialDto, auth);
  }

  @Get()
  findAll(@Query() query: FindMaterialsQueryDto) {
    return this.materialsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.materialsService.findOne(id, auth);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMaterialDto: UpdateMaterialDto,
    @Auth() auth: AuthContext,
  ) {
    return this.materialsService.update(id, updateMaterialDto, auth);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.materialsService.remove(id, auth);
  }
}
