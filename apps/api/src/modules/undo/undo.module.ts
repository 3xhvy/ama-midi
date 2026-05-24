import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { LedgerModule } from '../ledger/ledger.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { UndoService } from './undo.service'

@Module({
  imports: [PrismaModule, LedgerModule, ProjectAccessModule, ChartsModule],
  providers: [UndoService],
  exports: [UndoService],
})
export class UndoModule {}
