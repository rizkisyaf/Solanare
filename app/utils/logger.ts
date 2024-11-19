export const logger = {
  info: (message: string, data?: any) => {
    console.log(message, data)
  },
  error: (message: string, data?: any) => {
    console.error(message, data)
  }
} 