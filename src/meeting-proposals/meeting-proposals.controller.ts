import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ChatRoomQueryDto } from './dto/chat-room-query.dto';
import { CreateMeetingProposalDto } from './dto/create-meeting-proposal.dto';
import { FindMeetingProposalsQueryDto } from './dto/find-meeting-proposals-query.dto';
import { UpdateMeetingProposalDto } from './dto/update-meeting-proposal.dto';
import { MeetingProposalsService } from './meeting-proposals.service';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('meeting-proposals')
export class MeetingProposalsController {
  constructor(private readonly meetingProposalsService: MeetingProposalsService) {}

  /** Proposes a meetup in a chat; it shows up there as a card. */
  @Post()
  create(@Body() createMeetingProposalDto: CreateMeetingProposalDto, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.create(createMeetingProposalDto, auth);
  }

  @Get()
  findAll(@Query() { chatRoomId }: FindMeetingProposalsQueryDto, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.findAll(chatRoomId, auth);
  }

  /** Hour slots when both people in the chat are free, from their weekly class schedules. */
  @Get('suggestions')
  suggestions(@Query() { chatRoomId }: ChatRoomQueryDto, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.suggestions(chatRoomId, auth);
  }

  @Post(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.accept(id, auth);
  }

  @Post(':id/decline')
  decline(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.decline(id, auth);
  }

  /** The proposer withdraws a proposal nobody answered yet. */
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.meetingProposalsService.cancel(id, auth);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMeetingProposalDto: UpdateMeetingProposalDto) {
    return this.meetingProposalsService.update(id, updateMeetingProposalDto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingProposalsService.remove(id);
  }
}
