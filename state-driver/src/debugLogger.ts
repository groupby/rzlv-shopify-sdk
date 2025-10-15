export interface SDKConfig {
  debug?: boolean;
}

// Global configuration for our SDK debug logging.
// Clients can set this flag during SDK initialization.
export let sdkConfig: SDKConfig = {
  debug: false,
};

/**
 * Centralized debug logger.
 *
 * @param moduleName - Name of the module or area logging the message (e.g. 'Input Store', 'Search Manager', etc.)
 * @param message - The message to log.
 * @param args - Additional values to log.
 */
export function debugLog(moduleName: string, message: string, ...args: any[]): void {
  if (!sdkConfig.debug) return;
  console.log(
    `%c[State Driver SDK - ${moduleName}]: ${message}`,
    'color: green; font-weight: bold; font-size: 13px;',
    ...args
  );
}
