import { IsOptional, IsUUID } from 'class-validator';

export class FindMaterialsQueryDto {
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}
