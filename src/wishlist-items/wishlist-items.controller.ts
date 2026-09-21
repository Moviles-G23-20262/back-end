import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { WishlistItemsService } from './wishlist-items.service';

@Controller('wishlist-items')
export class WishlistItemsController {
  constructor(private readonly wishlistItemsService: WishlistItemsService) {}

  @Post()
  create(@Body() createWishlistItemDto: CreateWishlistItemDto) {
    return this.wishlistItemsService.create(createWishlistItemDto);
  }

  @Get()
  findAll() {
    return this.wishlistItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.wishlistItemsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWishlistItemDto: UpdateWishlistItemDto,
  ) {
    return this.wishlistItemsService.update(id, updateWishlistItemDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.wishlistItemsService.remove(id);
  }
}
