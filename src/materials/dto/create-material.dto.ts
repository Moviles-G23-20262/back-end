import { IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { MaterialCategory, MaterialCondition, MaterialStatus } from '../../generated/prisma/client';

export class CreateMaterialDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  @IsOptional()
  @IsEnum(MaterialCondition)
  condition?: MaterialCondition;

  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  // App users always sell as themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  // UUID the app made for this listing. Sending the same one again returns the material that was
  // already created instead of a duplicate (a listing saved offline may be sent more than once).
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsEnum(MaterialCategory)
  category!: MaterialCategory;
}
