import { Module } from '@nestjs/common'
import { LedgerListener } from './ledger.listener'

@Module({
  providers: [LedgerListener],
})
export class LedgerModule {}
