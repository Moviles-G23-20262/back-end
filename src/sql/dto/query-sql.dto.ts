import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QuerySqlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  query!: string;
}
