import { Module } from '@nestjs/common'
import { FileService } from './file.service'
import { LocalFilesController } from './local-files.controller'
import { R2StorageAdapter } from './adapters/r2.adapter'
import { LocalStorageAdapter } from './adapters/local.adapter'
import { join } from 'path'

const FILE_ADAPTER_TOKEN = 'FILE_ADAPTER'

@Module({
  controllers: [LocalFilesController],
  providers: [
    {
      provide: FILE_ADAPTER_TOKEN,
      useFactory: () => {
        const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
        if (R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
          return new R2StorageAdapter({
            endpoint: R2_ENDPOINT,
            bucket: R2_BUCKET,
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
          })
        }
        const basePath = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
        return new LocalStorageAdapter(basePath)
      },
    },
    {
      provide: FileService,
      useFactory: (adapter: InstanceType<typeof R2StorageAdapter | typeof LocalStorageAdapter>) =>
        new FileService(adapter),
      inject: [FILE_ADAPTER_TOKEN],
    },
  ],
  exports: [FileService],
})
export class FileModule {}
