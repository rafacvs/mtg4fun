// Only the arm-wrestling animation uses this clock. Samples travel through the
// existing game channel; scores and accepted input times stay on the server.
export class ArmClock {
  private pending = new Map<string, number>();
  private sample: { serverTime: number; receivedAt: number; rtt: number } | null = null;
  private readonly monotonic: () => number;

  constructor(monotonic = () => performance.now()) { this.monotonic = monotonic; }

  begin(nonce: string) { this.pending.set(nonce, this.monotonic()); }
  cancel(nonce: string) { this.pending.delete(nonce); }

  observe(nonce: string, serverTime: number) {
    const sentAt = this.pending.get(nonce);
    if (sentAt === undefined || !Number.isFinite(serverTime)) return;
    this.pending.delete(nonce);
    const receivedAt = this.monotonic();
    const rtt = Math.max(0, receivedAt - sentAt);
    // Prefer a recent, less congested sample. A delayed response must not
    // suddenly shift the pointer; refresh old samples as the route changes.
    if (this.sample && receivedAt - this.sample.receivedAt < 10_000 && rtt > this.sample.rtt + 5) return;
    this.sample = { serverTime, receivedAt, rtt };
  }

  now() {
    if (!this.sample) return null;
    return this.sample.serverTime + this.sample.rtt / 2 + this.monotonic() - this.sample.receivedAt;
  }

  inputTime() {
    const now = this.now();
    // Paint the position expected when a click sent now reaches the server.
    return now === null ? null : now + this.sample!.rtt / 2;
  }

  reset() { this.pending.clear(); this.sample = null; }
}
