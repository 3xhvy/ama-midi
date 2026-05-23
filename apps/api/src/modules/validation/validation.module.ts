import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ValidationController } from './validation.controller'
import { ValidationService } from './validation.service'

@Module({
  imports: [ProjectAccessModule],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
