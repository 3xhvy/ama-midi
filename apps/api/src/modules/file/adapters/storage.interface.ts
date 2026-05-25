export interface IStorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
