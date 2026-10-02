import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateScheduleBlockDto {
  // App users always add to their own schedule; only admins (dashboard) have to send it.
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** 1 = Monday … 7 = Sunday. */
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  /** Minutes after midnight, campus time. */
  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  endMinute!: number;

  /** What the class is, e.g. "MATH-201". */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}
