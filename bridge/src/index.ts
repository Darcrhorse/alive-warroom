/**
 * Main entry point for LLM Game Master Bridge Server
 */

import { BridgeServer } from './server';
import { configManager } from './config/settings';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Main function
function main() {
  logger.info('Starting LLM Game Master Bridge Server');
  
  const config = configManager.getConfig();
  
  // Log configuration (without sensitive data)
  logger.info('Configuration loaded', {
    provider: config.llm.provider,
    model: config.llm.model,
    port: config.server.port,
    dryRunMode: config.safety.dryRunMode
  });

  // Check for API key
  if (config.llm.provider === 'openai' && !config.llm.apiKey) {
    logger.warn('OpenAI API key not configured - running in passive mode');
    logger.warn('Set OPENAI_API_KEY environment variable to enable LLM features');
  }

  // Create and start server
  const server = new BridgeServer();
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    server.stop();
    process.exit(0);
  });
}

// Start the application
main();
