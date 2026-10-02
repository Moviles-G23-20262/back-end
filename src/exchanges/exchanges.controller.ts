import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CompleteExchangeDto } from './dto/complete-exchange.dto';
import { FindExchangesQueryDto } from './dto/find-exchanges-query.dto';
import { ExchangesService } from './exchanges.service';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  /** The dashboard records an exchange directly (a finished sale by default). */
  @AdminOnly()
  @Post()
  create(@Body() createExchangeDto: CreateExchangeDto) {
    return this.exchangesService.create(createExchangeDto);
  }

  /** The signed-in buyer orders a listing. */
  @Post('orders')
  placeOrder(@Body() placeOrderDto: PlaceOrderDto, @Auth() auth: AuthContext) {
    return this.exchangesService.placeOrder(placeOrderDto, auth);
  }

  @Get()
  findAll(@Query() query: FindExchangesQueryDto, @Auth() auth: AuthContext) {
    return this.exchangesService.findAll(query, auth);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.exchangesService.findOne(id, auth);
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeExchangeDto: CompleteExchangeDto,
    @Auth() auth: AuthContext,
  ) {
    return this.exchangesService.complete(id, completeExchangeDto, auth);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.exchangesService.cancel(id, auth);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateExchangeDto: UpdateExchangeDto) {
    return this.exchangesService.update(id, updateExchangeDto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.exchangesService.remove(id);
  }
}
