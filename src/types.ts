export interface CollateralArrangement {
  balance: number;
  initialLtv: number;
  maintenanceLtv: number;
  liquidationLtv: number;
}

export type Event = 'link' | 'recompute';

export type Status =
  | 'Good Standing'
  | 'Near Margin'
  | 'Initial Margin Call'
  | 'Maintenance Margin Call'
  | 'Liquidation';

export interface Limits {
  initial: number;
  maintenance: number;
  liquidation: number;
}
