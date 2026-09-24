import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { MeetingZoneType } from '../../generated/prisma/client';

export class CreateMeetingPointDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsEnum(MeetingZoneType)
  zoneType!: MeetingZoneType;

  @IsOptional()
  @IsBoolean()
  isMonitored?: boolean;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}
