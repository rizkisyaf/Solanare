type LogData = {
  error?: Error | unknown
  details?: Record<string, any>
  [key: string]: any
}

type LoggerFunction = (message: string, data?: LogData | Error | unknown) => void

export const logger = {
  info: ((message: string, data?: LogData | Error | unknown) => {
    console.log(`[INFO] ${message}`, formatLogData(normalizeLogData(data)))
  }) as LoggerFunction,
  
  warn: ((message: string, data?: LogData | Error | unknown) => {
    console.warn(`[WARN] ${message}`, formatLogData(normalizeLogData(data)))
  }) as LoggerFunction,
  
  error: ((message: string, data?: LogData | Error | unknown) => {
    console.error(`[ERROR] ${message}`, formatLogData(normalizeLogData(data)))
  }) as LoggerFunction
}

function normalizeLogData(data?: LogData | Error | unknown): LogData {
  if (!data) return {}
  
  if (data instanceof Error) {
    return {
      error: {
        name: data.name,
        message: data.message,
        stack: data.stack
      }
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    if ('error' in data) {
      const errorData = data as LogData
      if (errorData.error instanceof Error) {
        return {
          ...errorData,
          error: {
            name: errorData.error.name,
            message: errorData.error.message,
            stack: errorData.error.stack
          }
        }
      }
    }
    return data as LogData
  }
  
  return {
    error: String(data)
  }
}

function formatLogData(data: LogData): Record<string, any> {
  const formatted: Record<string, any> = {
    timestamp: new Date().toISOString()
  }
  
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'error') {
      formatted.error = value
    } else if (key === 'details') {
      formatted.details = value
    } else {
      formatted[key] = value
    }
  })

  return formatted
}