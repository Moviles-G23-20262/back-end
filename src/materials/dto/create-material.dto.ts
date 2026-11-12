import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaterialCategory, MaterialCondition, MaterialStatus } from '../../generated/prisma/client';
import { CollapseSpaces, IsCopPrice, NoControlChars, Trim } from '../../common/validation';

export class CreateMaterialDto {
  @CollapseSpaces()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @NoControlChars()
  title!: string;

  // Line breaks are fine here, so only the ends are trimmed.
  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  @NoControlChars()
  description!: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  // Pesos, 1.000 to 50.000.000: a 0 or an absurd price would distort the average ticket (BQ15).
  @IsCopPrice()
  price!: string;

  // Required: a sale without a condition would be left out of BQ15's per-condition averages.
  @IsEnum(MaterialCondition)
  condition!: MaterialCondition;

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
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false }, { each: true })
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
