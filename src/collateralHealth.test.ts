import {
  calculateLimits,
  computeHealth,
  getBaseStatus,
  NEAR_MARGIN_RATIO,
} from './collateralHealth';
import type { CollateralArrangement, Limits, Status } from './types';

function makeCa(overrides: Partial<CollateralArrangement> = {}): CollateralArrangement {
  return {
    balance: 2,
    initialLtv: 0.5,
    maintenanceLtv: 0.65,
    liquidationLtv: 0.8,
    ...overrides,
  };
}

describe('calculateLimits', () => {
  it('computes each limit as balance × price × LTV', () => {
    const limits = calculateLimits(makeCa(), 30000);
    expect(limits).toEqual({ initial: 30000, maintenance: 39000, liquidation: 48000 });
  });

  it('matches the documented 2 BTC × 30000 × 0.5 = 30000 example', () => {
    const limits = calculateLimits(
      { balance: 2, initialLtv: 0.5, maintenanceLtv: 0.5, liquidationLtv: 0.5 },
      30000,
    );
    expect(limits.initial).toBe(30000);
    expect(limits.maintenance).toBe(30000);
    expect(limits.liquidation).toBe(30000);
  });

  it('scales with balance and price', () => {
    const limits = calculateLimits(
      { balance: 1, initialLtv: 0.5, maintenanceLtv: 0.6, liquidationLtv: 0.7 },
      100,
    );
    expect(limits).toEqual({ initial: 50, maintenance: 60, liquidation: 70 });
  });
});

describe('getBaseStatus', () => {
  const limits: Limits = { initial: 30000, maintenance: 39000, liquidation: 48000 };

  it('returns Good Standing below the near-margin threshold', () => {
    expect(getBaseStatus(10000, limits)).toBe('Good Standing');
    expect(getBaseStatus(NEAR_MARGIN_RATIO * 30000 - 0.01, limits)).toBe('Good Standing');
  });

  it('returns Near Margin between 90% of initial and the initial limit', () => {
    expect(getBaseStatus(NEAR_MARGIN_RATIO * 30000, limits)).toBe('Near Margin');
    expect(getBaseStatus(29999, limits)).toBe('Near Margin');
  });

  it('returns Initial Margin Call at and above the initial limit', () => {
    expect(getBaseStatus(30000, limits)).toBe('Initial Margin Call');
    expect(getBaseStatus(35000, limits)).toBe('Initial Margin Call');
  });

  it('returns Maintenance Margin Call at and above the maintenance limit', () => {
    expect(getBaseStatus(39000, limits)).toBe('Maintenance Margin Call');
    expect(getBaseStatus(42000, limits)).toBe('Maintenance Margin Call');
  });

  it('returns Liquidation at and above the liquidation limit', () => {
    expect(getBaseStatus(48000, limits)).toBe('Liquidation');
    expect(getBaseStatus(50000, limits)).toBe('Liquidation');
  });

  it('resolves colliding maintenance/liquidation limits to the most severe status', () => {
    const colliding: Limits = { initial: 30000, maintenance: 39000, liquidation: 39000 };
    expect(getBaseStatus(39000, colliding)).toBe('Liquidation');
  });

  it('resolves colliding initial/maintenance limits to the most severe status', () => {
    const colliding: Limits = { initial: 30000, maintenance: 30000, liquidation: 48000 };
    expect(getBaseStatus(30000, colliding)).toBe('Maintenance Margin Call');
  });

  it('returns the most severe status at exact-boundary requirement == limit', () => {
    expect(getBaseStatus(30000, limits)).toBe('Initial Margin Call');
    expect(getBaseStatus(39000, limits)).toBe('Maintenance Margin Call');
    expect(getBaseStatus(48000, limits)).toBe('Liquidation');
  });
});

describe('computeHealth', () => {
  const ca = makeCa();

  it('recompute from Good Standing with requirement 42000 -> Maintenance Margin Call', () => {
    expect(computeHealth(ca, 42000, 30000, 'Good Standing', 'recompute')).toBe(
      'Maintenance Margin Call',
    );
  });

  it('link from Good Standing with requirement 42000 -> Initial Margin Call', () => {
    expect(computeHealth(ca, 42000, 30000, 'Good Standing', 'link')).toBe(
      'Initial Margin Call',
    );
  });

  it('link maps a healthy requirement to Good Standing', () => {
    expect(computeHealth(ca, 10000, 30000, 'Good Standing', 'link')).toBe('Good Standing');
  });

  it('link maps Near Margin to Initial Margin Call (only Good Standing survives)', () => {
    expect(computeHealth(ca, 28000, 30000, 'Good Standing', 'link')).toBe(
      'Initial Margin Call',
    );
  });

  it('link never overrides a previous Maintenance Margin Call', () => {
    expect(computeHealth(ca, 10000, 30000, 'Maintenance Margin Call', 'link')).toBe(
      'Maintenance Margin Call',
    );
  });

  it('link never overrides a previous Liquidation', () => {
    expect(computeHealth(ca, 10000, 30000, 'Liquidation', 'link')).toBe('Liquidation');
  });

  describe('Initial Lock (recompute from Initial Margin Call)', () => {
    it('clamps deterioration to Maintenance Margin Call', () => {
      expect(computeHealth(ca, 42000, 30000, 'Initial Margin Call', 'recompute')).toBe(
        'Initial Margin Call',
      );
    });

    it('clamps deterioration to Liquidation', () => {
      expect(computeHealth(ca, 50000, 30000, 'Initial Margin Call', 'recompute')).toBe(
        'Initial Margin Call',
      );
    });

    it('still allows improvement to Good Standing', () => {
      expect(computeHealth(ca, 10000, 30000, 'Initial Margin Call', 'recompute')).toBe(
        'Good Standing',
      );
    });
  });

  describe('Improvement Lock (recompute from Maintenance Margin Call / Liquidation)', () => {
    it('holds at Maintenance Margin Call while requirement >= initial limit', () => {
      expect(computeHealth(ca, 35000, 30000, 'Maintenance Margin Call', 'recompute')).toBe(
        'Maintenance Margin Call',
      );
    });

    it('may get worse while requirement >= initial limit', () => {
      expect(computeHealth(ca, 50000, 30000, 'Maintenance Margin Call', 'recompute')).toBe(
        'Liquidation',
      );
    });

    it('holds from Liquidation while requirement >= initial limit', () => {
      expect(computeHealth(ca, 35000, 30000, 'Liquidation', 'recompute')).toBe('Liquidation');
    });

    it('releases to base status when requirement drops below initial limit', () => {
      expect(computeHealth(ca, 25000, 30000, 'Maintenance Margin Call', 'recompute')).toBe(
        'Good Standing',
      );
    });

    it('releases to Near Margin when below initial but above near-margin threshold', () => {
      expect(computeHealth(ca, 28000, 30000, 'Maintenance Margin Call', 'recompute')).toBe(
        'Near Margin',
      );
    });
  });
});
