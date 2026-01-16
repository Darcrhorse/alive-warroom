/**
 * Winston logger configuration with date-based rotation
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Log directory - relative to bridge folder (this file is in bridge/src/utils/)
const LOG_DIR = path.resolve(__dirname, '../../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initial log level from environment
let currentLogLevel = process.env.LOG_LEVEL || 'info';

// Combined log rotation transport
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info'
});

// Error log rotation transport
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error'
});

export const logger = winston.createLogger({
  level: currentLogLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'llm-gamemaster' },
  transports: [
    combinedRotateTransport,
    errorRotateTransport
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Set the log level dynamically (used for --verbose flag)
 */
export function setLogLevel(level: string): void {
  currentLogLevel = level;
  logger.level = level;
  // Update all transports
  logger.transports.forEach((transport) => {
    if (transport.level !== 'error') {
      transport.level = level;
    }
  });
  logger.debug(`Log level set to: ${level}`);
}

/**
 * Truncate SQF code for logging purposes
 * Spec: truncation at 500 chars with format [first 200]...[truncated]...[last 100] (total: N chars)
 */
export function truncateSQF(sqf: string, maxLength: number = 500): string {
  if (!sqf || sqf.length <= maxLength) {
    return sqf;
  }

  const firstPortion = 200;
  const lastPortion = 100;

  const first = sqf.substring(0, firstPortion);
  const last = sqf.substring(sqf.length - lastPortion);

  return `${first}...[truncated]...${last} (total: ${sqf.length} chars)`;
}
