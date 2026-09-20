import { Body, Controller, Post } from '@nestjs/common';
import { QuerySqlDto } from './dto/query-sql.dto';
import { SqlService } from './sql.service';

@Controller('sql')
export class SqlController {
  constructor(private readonly sqlService: SqlService) {}

  @Post('query')
  query(@Body() querySqlDto: QuerySqlDto) {
    return this.sqlService.query(querySqlDto.query);
  }
}
