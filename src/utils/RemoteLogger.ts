class RemoteLogger {
  private static instance: RemoteLogger;
  private logs: string[] = [];
  
  public static getInstance(): RemoteLogger {
    if (!RemoteLogger.instance) {
      RemoteLogger.instance = new RemoteLogger();
    }
    return RemoteLogger.instance;
  }
  
  public log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    console.log(logEntry);
    this.logs.push(logEntry);
    
    // Send to a simple logging service (you can use httpbin.org for testing)
    if (!__DEV__) {
      fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: logEntry, app: 'FlynnAI' })
      }).catch(() => {}); // Ignore network errors
    }
  }
  
  public error(message: string, error?: any) {
    const errorMsg = error ? `${message}: ${error.toString()}` : message;
    this.log(errorMsg, 'error');
  }
  
  public info(message: string) {
    this.log(message, 'info');
  }
}

export const logger = RemoteLogger.getInstance();