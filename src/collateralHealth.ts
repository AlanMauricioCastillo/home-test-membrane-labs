import type {
  CollateralArrangement,
  Event,
  Limits,
  Status,
} from './types';

export { CollateralArrangement, Event, Limits, Status };

/**
 * The proportion of the initial limit that defines the "Near Margin" band.
 * A requirement is "Near Margin" when it is at or above this ratio of the
 * initial limit but still below the initial limit itself.
 *
 * 0.9 was chosen as a conservative early-warning threshold: it flags a
 * position well before it breaches the initial margin limit, giving an
 * external service time to react while the position is still fully healthy.
 */
export const NEAR_MARGIN_RATIO = 0.9;

const SEVERITY: Record<Status, number> = {
  'Good Standing': 0,
  'Near Margin': 1,
  'Initial Margin Call': 2,
  'Maintenance Margin Call': 3,
  'Liquidation': 4,
};

/**
 * Convert a Collateral Arrangement and a price into monetary limit values.
 *
 * Formula: limit = balance × mockPrice × LTV.
 * Example: balance 2, price 30000, LTV 0.5 -> 30000.
 */
export function calculateLimits(
  ca: CollateralArrangement,
  mockPrice: number,
): Limits {
  return {
    initial: ca.balance * mockPrice * ca.initialLtv,
    maintenance: ca.balance * mockPrice * ca.maintenanceLtv,
    liquidation: ca.balance * mockPrice * ca.liquidationLtv,
  };
}

/**
 * Determine the base status for a requirement purely from the numbers.
 *
 * Limits are assumed to be ordered initial <= maintenance <= liquidation,
 * which holds for any well-formed Collateral Arrangement (LTVs are always
 * in increasing order). The ranges are checked from the most severe status
 * downward using `>=`, so a requirement that collides with two limits at
 * once resolves to the most severe status.
 */
export function getBaseStatus(requirement: number, limits: Limits): Status {
  if (requirement >= limits.liquidation) {
    return 'Liquidation';
  }
  if (requirement >= limits.maintenance) {
    return 'Maintenance Margin Call';
  }
  if (requirement >= limits.initial) {
    return 'Initial Margin Call';
  }
  if (requirement >= NEAR_MARGIN_RATIO * limits.initial) {
    return 'Near Margin';
  }
  return 'Good Standing';
}

function moreSevere(a: Status, b: Status): Status {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * 'link' event: the final status can only be 'Good Standing' or
 * 'Initial Margin Call'. If the previous status was already
 * 'Maintenance Margin Call' or 'Liquidation', it is returned unchanged.
 */
function applyLinkTransition(
  baseStatus: Status,
  previousStatus: Status,
): Status {
  if (
    previousStatus === 'Maintenance Margin Call' ||
    previousStatus === 'Liquidation'
  ) {
    return previousStatus;
  }
  return baseStatus === 'Good Standing' ? 'Good Standing' : 'Initial Margin Call';
}

/**
 * 'recompute' event: apply the two state locks.
 *
 * - Initial Lock: from 'Initial Margin Call' the CA may not deteriorate to
 *   'Maintenance Margin Call' or 'Liquidation'; it is clamped at
 *   'Initial Margin Call'. Improvement is still allowed.
 *
 * - Improvement Lock (hysteresis): from 'Maintenance Margin Call' or
 *   'Liquidation', while the requirement stays at or above the initial
 *   limit the status remains at least as severe as the previous status
 *   (it may still get worse). Once the requirement drops below the initial
 *   limit the lock releases and the base status applies.
 */
function applyRecomputeTransition(
  baseStatus: Status,
  previousStatus: Status,
  requirement: number,
  limits: Limits,
): Status {
  if (previousStatus === 'Initial Margin Call') {
    if (
      baseStatus === 'Maintenance Margin Call' ||
      baseStatus === 'Liquidation'
    ) {
      return 'Initial Margin Call';
    }
    return baseStatus;
  }

  if (
    previousStatus === 'Maintenance Margin Call' ||
    previousStatus === 'Liquidation'
  ) {
    if (requirement >= limits.initial) {
      return moreSevere(baseStatus, previousStatus);
    }
    return baseStatus;
  }

  return baseStatus;
}

/**
 * Compute the health status of a Collateral Arrangement.
 *
 * Pure function: computes the limits and base status, then applies the
 * transition rules for the given event.
 */
export function computeHealth(
  ca: CollateralArrangement,
  requirement: number,
  mockPrice: number,
  previousStatus: Status,
  event: Event,
): Status {
  const limits = calculateLimits(ca, mockPrice);
  const baseStatus = getBaseStatus(requirement, limits);

  if (event === 'link') {
    return applyLinkTransition(baseStatus, previousStatus);
  }

  return applyRecomputeTransition(baseStatus, previousStatus, requirement, limits);
}
