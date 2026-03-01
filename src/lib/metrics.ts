export class MetricsRegistry {
  private requestCount = 0;
  private errorCount = 0;

  incrementRequests(): void {
    this.requestCount += 1;
  }

  incrementErrors(): void {
    this.errorCount += 1;
  }

  snapshot(): { requestCount: number; errorCount: number } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount
    };
  }
}
