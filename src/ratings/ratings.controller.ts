import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CreateRatingDto } from './dto/create-rating.dto';
import { FindRatingsQueryDto } from './dto/find-ratings-query.dto';
import { RatingsService } from './ratings.service';
import { Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  create(@Body() createRatingDto: CreateRatingDto, @Auth() auth: AuthContext) {
    return this.ratingsService.create(createRatingDto, auth);
  }

  @Get()
  findAll(@Query() query: FindRatingsQueryDto) {
    return this.ratingsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ratingsService.findOne(id);
  }
}