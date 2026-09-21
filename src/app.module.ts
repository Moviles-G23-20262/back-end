import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MaterialsModule } from './materials/materials.module';
import { ChatroomsModule } from './chatrooms/chatrooms.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma.module';
import { SqlModule } from './sql/sql.module';
import { ExchangesModule } from './exchanges/exchanges.module';
import { WishlistItemsModule } from './wishlist-items/wishlist-items.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsEventsModule } from './analytics-events/analytics-events.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MaterialsModule,
    ChatroomsModule,
    MessagesModule,
    SqlModule,
    ExchangesModule,
    WishlistItemsModule,
    NotificationsModule,
    AnalyticsEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
