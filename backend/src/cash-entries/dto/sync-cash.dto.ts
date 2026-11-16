import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CashEntryDto } from './cash-entry.dto';

export class SyncCashDto {
  @ApiProperty({ type: [CashEntryDto], description: 'Daftar entri kas yang akan disinkronkan (maks. 200)' })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CashEntryDto)
  entries: CashEntryDto[];
}
