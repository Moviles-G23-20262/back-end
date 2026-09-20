import { IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { MaterialCondition, MaterialStatus } from '../../generated/prisma/client';

export class CreateMaterialDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  courseCode!: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  @IsEnum(MaterialCondition)
  condition!: MaterialCondition;

  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @IsUUID()
  sellerId!: string;
}
