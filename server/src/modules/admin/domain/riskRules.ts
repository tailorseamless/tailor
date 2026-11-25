/**
 * Pure rules for anomaly detection and churn risk — no I/O (Backend Guide §27). The numbers are
 * starting points for a young platform; they live here so they can be tuned in one place.
 */

/** The kinds of activity watched for anomalies, and the least that can count as one. */
export const ANOMALY_GROUPS = {
  payment_reversals: { label: "payments voided or refunded", minCount: 3 },
  customer_deletions: { label: "customers deleted", minCount: 10 },
  measurement_deletions: { label: "measurements deleted", minCount: 15 },
  order_cancellations: { label: "orders cancelled", minCount: 5 },
} as const;
export type AnomalyGroup = keyof typeof ANOMALY_GROUPS;

/** Days of history a business's normal is learned from (the last day itself excluded). */
export const BASELINE_DAYS = 28;

/**
 * How many in the last 24 hours is unusual for THIS business: well above its own daily normal
 * (mean + 3 standard deviations, and at least 3 × the mean) and never below the group's minimum.
 * A business with no history only has the minimum to beat.
 */
export function anomalyThreshold(group: AnomalyGroup, mean: number, stdDev: number): number {
  return Math.max(ANOMALY_GROUPS[group].minCount, Math.ceil(mean + 3 * stdDev), Math.ceil(mean * 3));
}

/** Mean and standard deviation of daily counts over the baseline, from their sum and sum of squares (zero days included). */
export function baselineStats(
  sum: number,
  sumOfSquares: number,
  days = BASELINE_DAYS,
): { mean: number; stdDev: number } {
  const mean = sum / days;
  return { mean, stdDev: Math.sqrt(Math.max(0, sumOfSquares / days - mean * mean)) };
}

export interface ChurnInput {
  /** Days since a person last did anything in the business (null: never). */
  daysSinceActivity: number | null;
  /** Actions by people in the last 14 days, and in the 14 before that. */
  recentEvents: number;
  previousEvents: number;
  ordersLast30Days: number;
  /** The owner's getting-started guide: steps done of all, or null when never opened. */
  onboarding: { done: number; total: number; dismissed: boolean } | null;
  /** Team members who have signed in at least once. */
  peopleSignedIn: number;
}

export type ChurnLevel = "high" | "medium" | "low";

export interface ChurnRisk {
  score: number;
  level: ChurnLevel;
  reasons: string[];
}

/**
 * How likely a business is to stop using the platform, 0–100, with the reasons in words. Additive
 * and explainable on purpose: an admin should see WHY, and can call the owner about exactly that.
 */
export function churnRisk(input: ChurnInput): ChurnRisk {
  let score = 0;
  const reasons: string[] = [];
  const idle = input.daysSinceActivity;

  if (idle === null || idle >= 30) {
    score += 45;
    reasons.push(idle === null ? "Nobody has used it yet" : `Nobody has used it for ${idle} days`);
  } else if (idle >= 14) {
    score += 30;
    reasons.push(`Nobody has used it for ${idle} days`);
  } else if (idle >= 7) {
    score += 15;
    reasons.push(`Quiet for ${idle} days`);
  }

  if (input.previousEvents >= 10 && input.recentEvents < input.previousEvents / 2) {
    const drop = Math.round((1 - input.recentEvents / input.previousEvents) * 100);
    score += 25;
    reasons.push(`Activity down ${drop}% on the fortnight before`);
  }

  if (input.ordersLast30Days === 0) {
    score += 15;
    reasons.push("No orders in 30 days");
  }

  const guide = input.onboarding;
  if (guide && !guide.dismissed && guide.done < guide.total) {
    score += 10;
    reasons.push(`Setup unfinished (${guide.done} of ${guide.total} steps)`);
  }

  if (input.peopleSignedIn <= 1) {
    score += 5;
    reasons.push("Only one person uses it");
  }

  score = Math.min(100, score);
  return { score, level: score >= 60 ? "high" : score >= 35 ? "medium" : "low", reasons };
}
