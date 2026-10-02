import { IsEnum, IsOptional } from 'class-validator';
import { MaterialCondition } from '../../generated/prisma/client';

export class CompleteExchangeDto {
  /** The condition the buyer says they received. */
  @IsOptional()
  @IsEnum(MaterialCondition)
  receivedCondition?: MaterialCondition;
}
