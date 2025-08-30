export class Logger {
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  public info(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[GaslessSDK][INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.debug) {
      console.warn(`[GaslessSDK][WARN] ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.debug) {
      console.error(`[GaslessSDK][ERROR] ${message}`, ...args);
    }
  }

  public debug_log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.debug(`[GaslessSDK][DEBUG] ${message}`, ...args);
    }
  }

  public setDebug(debug: boolean): void {
    this.debug = debug;
  }

  public isDebugEnabled(): boolean {
    return this.debug;
  }
}
