type LogLevel = 'info' | 'warn' | 'error'
type LogData = Record<string, unknown>

export const logger = {
  info: (message: string, data?: LogData) => {
    console.log(`[INFO] ${message}`, data)
  },
  warn: (message: string, data?: LogData) => {
    console.warn(`[WARN] ${message}`, data)
  },
  error: (message: string, error?: Error | unknown) => {
    console.error(`[ERROR] ${message}`, error)
  }
} 