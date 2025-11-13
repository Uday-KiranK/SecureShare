/**
 * Centralized error logging utility
 * Logs detailed errors server-side while showing generic messages to users
 */

interface ErrorLogOptions {
  context?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

class ErrorLogger {
  /**
   * Log an error with full details (server-side in production)
   * Shows only generic message to end users
   */
  logError(error: unknown, options?: ErrorLogOptions): void {
    // In development, log everything to console
    if (import.meta.env.DEV) {
      console.error('[Error]', {
        message: error instanceof Error ? error.message : String(error),
        context: options?.context,
        userId: options?.userId,
        additionalData: options?.additionalData,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return;
    }

    // In production, only log generic info to console
    // Full errors should be sent to a logging service (Sentry, LogRocket, etc.)
    console.warn('An error occurred. Error ID:', this.generateErrorId());
    
    // TODO: Send to external logging service in production
    // Example: Sentry.captureException(error, { contexts: options });
  }

  /**
   * Get a user-friendly error message without exposing internals
   */
  getUserMessage(error: unknown): string {
    if (error instanceof Error) {
      // Only return safe, generic messages in production
      if (!import.meta.env.DEV) {
        return 'An unexpected error occurred. Please try again.';
      }
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Generate a unique error ID for tracking
   */
  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const errorLogger = new ErrorLogger();
