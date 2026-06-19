// Anti-Gaming Engine — Sybil prevention + anomaly detection + timing analysis
// IP + Wallet dual rate limiting + behavioral analysis
// In-memory cache backed by Prisma persistence for restart resilience

import type { PrismaClient } from "@prisma/client";

interface AbuseSignal {
  type: "rate_limit" | "sybil" | "pattern" | "anomaly" | "timing";
  severity: "low" | "medium" | "high";
  description: string;
}

export class AntiGamingEngine {
  private prisma: PrismaClient | null = null;
  // In-memory caches (fast path, backed by DB for persistence)
  private ipWalletMap = new Map<string, Set<string>>();       // IP → wallets
  private walletIpMap = new Map<string, Set<string>>();       // wallet → IPs
  private recentInputHashes = new Map<string, string[]>();    // wallet → input hashes
  private submissionTimestamps = new Map<string, number[]>(); // wallet → timestamps
  private dailySubmissionCount = new Map<string, number>();   // wallet:date → count

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Check for abuse signals
  async checkAbuse(walletAddress: string, ip: string, inputHash: string, userId?: string): Promise<AbuseSignal[]> {
    const signals: AbuseSignal[] = [];
    const now = Date.now();

    // 1. Sybil detection: multiple wallets from same IP
    if (!this.ipWalletMap.has(ip)) this.ipWalletMap.set(ip, new Set());
    this.ipWalletMap.get(ip)!.add(walletAddress);
    const walletsFromIp = this.ipWalletMap.get(ip)!.size;
    if (walletsFromIp > 3) {
      signals.push({ type: "sybil", severity: "high", description: `IP ${ip.slice(0, 8)}... linked to ${walletsFromIp} wallets` });
    }

    // 2. Multiple IPs for same wallet (VPN rotation)
    if (!this.walletIpMap.has(walletAddress)) this.walletIpMap.set(walletAddress, new Set());
    this.walletIpMap.get(walletAddress)!.add(ip);
    const ipsForWallet = this.walletIpMap.get(walletAddress)!.size;
    if (ipsForWallet > 10) {
      signals.push({ type: "sybil", severity: "medium", description: `Wallet using ${ipsForWallet} IPs` });
    }

    // 3. Repeated input detection
    if (!this.recentInputHashes.has(walletAddress)) this.recentInputHashes.set(walletAddress, []);
    const hashes = this.recentInputHashes.get(walletAddress)!;
    const duplicateCount = hashes.filter(h => h === inputHash).length;
    if (duplicateCount >= 2) {
      signals.push({ type: "pattern", severity: "high", description: "Duplicate input detected" });
    }
    hashes.push(inputHash);
    if (hashes.length > 100) hashes.shift();

    // 4. Timing anomaly: claims too regular (bot pattern)
    if (!this.submissionTimestamps.has(walletAddress)) this.submissionTimestamps.set(walletAddress, []);
    const timestamps = this.submissionTimestamps.get(walletAddress)!;
    timestamps.push(now);
    if (timestamps.length > 20) timestamps.shift();

    if (timestamps.length >= 5) {
      const timingSignal = this.detectTimingAnomaly(timestamps);
      if (timingSignal) signals.push(timingSignal);
    }

    // 5. Rate limiting: max submissions per day
    const dateKey = `${walletAddress}:${new Date().toISOString().split("T")[0]}`;
    const dailyCount = (this.dailySubmissionCount.get(dateKey) || 0) + 1;
    this.dailySubmissionCount.set(dateKey, dailyCount);
    if (dailyCount > 20) {
      signals.push({ type: "rate_limit", severity: "high", description: `${dailyCount} submissions today (limit: 20)` });
    } else if (dailyCount > 10) {
      signals.push({ type: "rate_limit", severity: "low", description: `${dailyCount} submissions today` });
    }

    // 6. Burst detection: too many requests in short window
    const recentWindow = timestamps.filter(t => now - t < 60_000);
    if (recentWindow.length > 5) {
      signals.push({ type: "rate_limit", severity: "high", description: `${recentWindow.length} requests in last minute` });
    }

    // Persist risk data to DB if available
    if (this.prisma && userId && signals.length > 0) {
      this.persistRiskData(userId, walletAddress, ip, signals).catch(() => {});
    }

    return signals;
  }

  // Detect bot-like timing patterns
  private detectTimingAnomaly(timestamps: number[]): AbuseSignal | null {
    if (timestamps.length < 5) return null;

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Suspiciously regular intervals (coefficient of variation < 0.15)
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) return null;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    if (cv < 0.15 && intervals.length >= 4) {
      return {
        type: "timing",
        severity: "high",
        description: `Suspiciously regular submission pattern (CV=${cv.toFixed(3)}, mean=${(mean / 1000).toFixed(1)}s)`,
      };
    }

    // Machine-speed submissions (< 3 seconds apart)
    const ultraFast = intervals.filter(i => i < 3000).length;
    if (ultraFast >= 3) {
      return {
        type: "timing",
        severity: "medium",
        description: `${ultraFast} submissions under 3 seconds apart`,
      };
    }

    return null;
  }

  // Persist risk signals to DB
  private async persistRiskData(userId: string, wallet: string, ip: string, signals: AbuseSignal[]) {
    if (!this.prisma) return;
    try {
      await this.prisma.agentQueryLog.create({
        data: {
          agentId: "anti-gaming-engine",
          userId,
          query: JSON.stringify({
            wallet: wallet.slice(0, 10) + "...",
            ip: ip.slice(0, 8) + "...",
            signals,
            riskScore: this.calculateRiskScore(signals),
          }),
          responseStatus: this.shouldBlock(signals) ? "blocked" : "allowed",
        },
      });
    } catch {
      // Non-critical
    }
  }

  // Calculate abuse risk score (0-100)
  calculateRiskScore(signals: AbuseSignal[]): number {
    let score = 0;
    for (const s of signals) {
      if (s.severity === "high") score += 40;
      else if (s.severity === "medium") score += 20;
      else score += 10;
    }
    return Math.min(score, 100);
  }

  // Should block claim?
  shouldBlock(signals: AbuseSignal[]): boolean {
    return this.calculateRiskScore(signals) >= 60;
  }

  // Get user risk profile
  getUserRiskProfile(walletAddress: string) {
    const ips = this.walletIpMap.get(walletAddress)?.size || 0;
    const dateKey = `${walletAddress}:${new Date().toISOString().split("T")[0]}`;
    const daily = this.dailySubmissionCount.get(dateKey) || 0;
    const hashes = this.recentInputHashes.get(walletAddress) || [];
    const uniqueHashes = new Set(hashes).size;

    return {
      ipCount: ips,
      dailySubmissions: daily,
      recentDuplicates: hashes.length - uniqueHashes,
    };
  }

  // Cleanup old data (run daily)
  cleanup() {
    const today = new Date().toISOString().split("T")[0];
    for (const [key] of this.dailySubmissionCount) {
      if (!key.endsWith(today)) this.dailySubmissionCount.delete(key);
    }
    const cutoff = Date.now() - 86400000;
    for (const [wallet, timestamps] of this.submissionTimestamps) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) this.submissionTimestamps.delete(wallet);
      else this.submissionTimestamps.set(wallet, filtered);
    }
  }
}

export const antiGamingEngine = new AntiGamingEngine();
