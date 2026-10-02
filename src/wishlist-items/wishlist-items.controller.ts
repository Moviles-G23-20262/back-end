import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { WishlistItemsService } from './wishlist-items.service';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { AdminOnly, Auth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth-context';

@Controller('wishlist-items')
export class WishlistItemsController {
  constructor(private readonly wishlistItemsService: WishlistItemsService) {}

  @Post()
  create(@Body() createWishlistItemDto: CreateWishlistItemDto, @Auth() auth: AuthContext) {
    return this.wishlistItemsService.create(createWishlistItemDto, auth);
  }

  @Get()
  findAll(@Auth() auth: AuthContext) {
    return this.wishlistItemsService.findAll(auth);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.wishlistItemsService.findOne(id, auth);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateWishlistItemDto: UpdateWishlistItemDto) {
    return this.wishlistItemsService.update(id, updateWishlistItemDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext) {
    return this.wishlistItemsService.remove(id, auth);
  }
}
