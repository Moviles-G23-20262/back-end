import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ChatroomsService } from './chatrooms.service';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { UpdateChatroomDto } from './dto/update-chatroom.dto';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('chatrooms')
export class ChatroomsController {
  constructor(private readonly chatroomsService: ChatroomsService) {}

  @Post()
  create(@Body() createChatroomDto: CreateChatroomDto, @Auth() auth: AuthContext) {
    return this.chatroomsService.create(createChatroomDto, auth);
  }

  @Get()
  findAll(@Auth() auth: AuthContext) {
    return this.chatroomsService.findAll(auth);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.chatroomsService.findOne(id, auth);
  }

  @Post(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.chatroomsService.markRead(id, auth);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateChatroomDto: UpdateChatroomDto) {
    return this.chatroomsService.update(id, updateChatroomDto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatroomsService.remove(id);
  }
}
