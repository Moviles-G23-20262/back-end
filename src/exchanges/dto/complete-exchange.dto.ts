import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MaterialCondition } from '../../generated/prisma/client';

export class CompleteExchangeDto {
  /** The condition the buyer says they received. */
  @IsOptional()
  @IsEnum(MaterialCondition)
  receivedCondition?: MaterialCondition;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
