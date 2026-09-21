import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { WishlistItemsController } from './wishlist-items.controller';
import { WishlistItemsService } from './wishlist-items.service';

@Module({
  imports: [PrismaModule],
  controllers: [WishlistItemsController],
  providers: [WishlistItemsService],
})
export class WishlistItemsModule {}
