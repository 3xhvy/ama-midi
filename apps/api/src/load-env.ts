// Load .env locally only — production gets env from Docker / compose env_file
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config')
}
