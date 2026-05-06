/**
 * Structured logger for PolyAgent
 * Supports different log levels and formats for production/development
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'system'

interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  data?: any
}

class Logger {
  private formatEntry(level: LogLevel, context: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    }
  }

  private log(entry: LogEntry) {
    const { timestamp, level, context, message, data } = entry
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`

    if (process.env.NODE_ENV === 'production') {
      // JSON logging for production (easier for cloud log aggregators)
      console.log(JSON.stringify(entry))
      return
    }

    // Pretty logging for development
    let color = '\x1b[37m' // white
    switch (level) {
      case 'info': color = '\x1b[32m'; break // green
      case 'warn': color = '\x1b[33m'; break // yellow
      case 'error': color = '\x1b[31m'; break // red
      case 'debug': color = '\x1b[36m'; break // cyan
      case 'system': color = '\x1b[35m'; break // magenta
    }

    const reset = '\x1b[0m'
    console.log(`${color}${prefix}${reset} ${message}`, data || '')
  }

  info(context: string, message: string, data?: any) {
    this.log(this.formatEntry('info', context, message, data))
  }

  warn(context: string, message: string, data?: any) {
    this.log(this.formatEntry('warn', context, message, data))
  }

  error(context: string, message: string, data?: any) {
    this.log(this.formatEntry('error', context, message, data))
  }

  debug(context: string, message: string, data?: any) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      this.log(this.formatEntry('debug', context, message, data))
    }
  }

  system(context: string, message: string, data?: any) {
    this.log(this.formatEntry('system', context, message, data))
  }
}

export const logger = new Logger()
