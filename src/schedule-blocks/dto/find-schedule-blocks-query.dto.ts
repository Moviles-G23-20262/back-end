import { IsOptional, IsUUID } from 'class-validator';

export class FindScheduleBlocksQueryDto {
  /** Admins only; app users always get their own schedule. */
  @IsOptional()
  @IsUUID()
  userId?: string;
}
