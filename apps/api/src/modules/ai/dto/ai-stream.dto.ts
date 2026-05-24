import { Type } from 'class-transformer'
import type { TypeHelpOptions } from 'class-transformer/types/interfaces/type-help-options.interface'
import { IsIn, ValidateNested } from 'class-validator'
import { GenerateChartDto, ScaleChartDto } from './chart.dto'
import { SuggestNotesDto } from './suggest-notes.dto'

export class AiStreamEnvelopeDto {
  @IsIn(['generate-chart', 'scale-chart', 'suggest-notes'])
  action!: 'generate-chart' | 'scale-chart' | 'suggest-notes'

  @ValidateNested()
  @Type((opts?: TypeHelpOptions) => {
    const action = opts?.object?.action
    if (action === 'scale-chart') return ScaleChartDto
    if (action === 'suggest-notes') return SuggestNotesDto
    return GenerateChartDto
  })
  payload!: GenerateChartDto | ScaleChartDto | SuggestNotesDto
}
