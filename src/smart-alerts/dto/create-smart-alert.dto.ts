import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { MaterialCategory, MaterialCondition } from '../../generated/prisma/client';

export class CreateSmartAlertDto {
  // App users always save alerts for themselves; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsEnum(MaterialCategory)
  category?: MaterialCategory;

  @Matches(/^\d+(\.\d{1,2})?$/)
  maxPrice!: string;

  @IsOptional()
  @IsEnum(MaterialCondition)
  minCondition?: MaterialCondition;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
