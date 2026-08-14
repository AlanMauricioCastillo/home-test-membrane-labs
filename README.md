# Collateral Health

A pure, functional TypeScript library that computes the health status of a
loan (Collateral Arrangement - CA).

## Installation

```sh
npm install @mauricio_castillo/collateral-health
```

## Quickstart

```ts
import { computeHealth } from '@mauricio_castillo/collateral-health';
import type { CollateralArrangement } from '@mauricio_castillo/collateral-health';

const ca: CollateralArrangement = {
  balance: 2,            // 2 BTC
  initialLtv: 0.5,       // 50%
  maintenanceLtv: 0.65,  // 65%
  liquidationLtv: 0.8,   // 80%
};

const status = computeHealth(ca, 42_000, 30_000, 'Good Standing', 'recompute');
console.log(status); // => 'Maintenance Margin Call'
```

The package ships both CommonJS (`require`) and ES module (`import`) builds,
plus TypeScript declarations, so it works out of the box in any Node or
bundler project.

### Run it locally (no npm install)

From a clone of this repo, build once and then run the script directly with
custom arguments:

```sh
npm install
npm run build
node run.js --balance 3 --price 60000 --requirement 100000 --event link
```

`node run.js` (no arguments) runs the documented example. Run
`node run.js --help` for all options.

### Run the TypeScript source directly (no build)

You can also run the source without compiling first, using `tsx`:

```sh
npx tsx index.ts
npx tsx index.ts --balance 3 --price 60000 --requirement 100000 --event link
# or, after npm install:
npm run dev -- --balance 3 --price 60000 --requirement 100000 --event link
```

`npx tsx index.ts` (no arguments) runs the documented example. Run
`npx tsx index.ts --help` for all options.

## API

- `calculateLimits(ca, mockPrice): Limits` — turns a Collateral Arrangement and
  a price into monetary limits (`balance × mockPrice × LTV`).
- `getBaseStatus(requirement, limits): Status` — maps a requirement into one of
  the five statuses purely from the numbers.
- `computeHealth(ca, requirement, mockPrice, previousStatus, event): Status` —
  combines the two above and applies the `link` / `recompute` transition rules.
- `NEAR_MARGIN_RATIO` — the constant (0.9) defining the "Near Margin" band.

Statuses: `Good Standing`, `Near Margin`, `Initial Margin Call`,
`Maintenance Margin Call`, `Liquidation`.

## Usage

```ts
import { computeHealth } from '@mauricio_castillo/collateral-health';
import type { CollateralArrangement } from '@mauricio_castillo/collateral-health';

const ca: CollateralArrangement = {
  balance: 2,          // 2 BTC
  initialLtv: 0.5,     // 50%
  maintenanceLtv: 0.65,// 65%
  liquidationLtv: 0.8, // 80%
};

// Linking a new CA: status can only be Good Standing or Initial Margin Call.
computeHealth(ca, 42_000, 30_000, 'Good Standing', 'link');
// => 'Initial Margin Call'

// Recomputing an existing CA: full status range applies.
computeHealth(ca, 42_000, 30_000, 'Good Standing', 'recompute');
// => 'Maintenance Margin Call'
```

## Design rationale

- **Interfaces instead of classes**: every value is a plain, immutable
  interface, so functions are pure and there is no mutable state to reason
  about.
- **Math separated from business rules**: `calculateLimits` and `getBaseStatus`
  are pure number comparisons, testable in isolation from the state-machine
  rules.
- **Single-responsibility split**: `getBaseStatus` only compares a requirement
  against limits; `computeHealth` only encodes the transition rules between
  events and previous states.

## Out of Scope

- Database / Persistence: Not included to keep the library pure and infrastructure-agnostic.
- HTTP Controllers: Out of scope; the library is designed to be invoked by external services.
- Data Validation (e.g., Zod): It was assumed that inputs are validated by the external layer (controllers) to keep the core simple.
