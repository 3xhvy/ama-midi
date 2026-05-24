import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { LedgerListener } from './ledger.listener'
import { EditorEventService } from './editor-event.service'

@Module({
  imports: [PrismaModule],
  providers: [LedgerListener, EditorEventService],
  exports: [EditorEventService],
})
export class LedgerModule {}
