import {
  calculateLimits,
  getBaseStatus,
  computeHealth,
} from './src';
import type { CollateralArrangement, Status } from './src';

const DEFAULTS: Record<string, string> = {
  balance: '2',
  'initial-ltv': '0.5',
  'maintenance-ltv': '0.65',
  'liquidation-ltv': '0.8',
  requirement: '42000',
  price: '30000',
  previous: 'Good Standing',
  event: 'recompute',
};

const HELP = `Usage: npx tsx index.ts [options]

Computes the collateral-health status for the given inputs.
Run without options to see the documented example.

Options:
  --balance <n>           Collateral balance (default ${DEFAULTS.balance})
  --initial-ltv <n>       Initial LTV      (default ${DEFAULTS['initial-ltv']})
  --maintenance-ltv <n>   Maintenance LTV  (default ${DEFAULTS['maintenance-ltv']})
  --liquidation-ltv <n>   Liquidation LTV  (default ${DEFAULTS['liquidation-ltv']})
  --requirement <n>       Requirement amount (default ${DEFAULTS.requirement})
  --price <n>             Mock price      (default ${DEFAULTS.price})
  --previous <status>     Previous status  (default "${DEFAULTS.previous}")
  --event <link|recompute>  Event          (default ${DEFAULTS.event})
  -h, --help              Show this help

Examples:
  npx tsx index.ts
  npx tsx index.ts --balance 3 --price 60000 --requirement 100000 --event link
`;

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === '-h' || raw === '--help') {
      args.help = '1';
      continue;
    }
    if (!raw.startsWith('-')) continue;
    const stripped = raw.replace(/^-+/, '');
    if (stripped.includes('=')) {
      const [key, value] = stripped.split('=', 2);
      args[key] = value;
    } else {
      const key = stripped;
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for --${key}`);
      args[key] = value;
    }
  }
  return args;
}

function num(value: string, name: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Invalid number for --${name}: "${value}"`);
  return n;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const ca: CollateralArrangement = {
    balance: num(args.balance, 'balance'),
    initialLtv: num(args['initial-ltv'], 'initial-ltv'),
    maintenanceLtv: num(args['maintenance-ltv'], 'maintenance-ltv'),
    liquidationLtv: num(args['liquidation-ltv'], 'liquidation-ltv'),
  };
  const requirement = num(args.requirement, 'requirement');
  const price = num(args.price, 'price');
  const previousStatus = args.previous as Status;
  const event = args.event as 'link' | 'recompute';

  const limits = calculateLimits(ca, price);
  const baseStatus = getBaseStatus(requirement, limits);
  const status = computeHealth(ca, requirement, price, previousStatus, event);

  console.log('Collateral Arrangement:', JSON.stringify(ca));
  console.log('Requirement:', requirement, '| Price:', price);
  console.log('Limits:', JSON.stringify(limits));
  console.log('Base status:', baseStatus);
  console.log(`Health status (${event} from "${previousStatus}"):`, status);
}

try {
  main();
} catch (err) {
  console.error('Error:', (err as Error).message);
  console.error(HELP);
  process.exit(1);
}
