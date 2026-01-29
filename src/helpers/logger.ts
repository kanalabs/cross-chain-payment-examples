export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.context}] ℹ️  ${message}`, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`[${this.context}] ✅ ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.context}] ❌ ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.context}] ⚠️  ${message}`, ...args);
  }

  step(stepNumber: number, message: string) {
    console.log(`\n[${this.context}] Step ${stepNumber}: ${message}`);
  }

  divider() {
    console.log('\n' + '='.repeat(80) + '\n');
  }
}
