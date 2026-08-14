#!/usr/bin/env node
'use strict';

let lib;
try {
  lib = require('./dist/cjs/index.js');
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error(
      'dist/ not found. Run "npm run build" first, then try again:\n' +
      '  npm run build\n' +
      '  node run.js --balance 3 --price 60000 --requirement 100000',
    );
    process.exit(1);
  }
  throw err;
}

const { calculateLimits, getBaseStatus, computeHealth } = lib;

const DEFAULTS = {
  balance: 2,
  'initial-ltv': 0.5,
  'maintenance-ltv': 0.65,
  'liquidation-ltv': 0.8,
  requirement: 42000,
  price: 30000,
  previous: 'Good Standing',
  event: 'recompute',
};

const HELP = `Usage: node run.js [options]

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
  node run.js
  node run.js --balance 3 --price 60000 --requirement 100000 --event link
  node run.js --previous "Initial Margin Call" --requirement 90000
`;

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    let raw = argv[i];
    if (raw === '-h' || raw === '--help') {
      args.help = true;
      continue;
    }
    if (!raw.startsWith('-')) continue;
    raw = raw.replace(/^-+/, '');
    let key = raw;
    let value;
    if (raw.includes('=')) {
      [key, value] = raw.split('=', 2);
    } else {
      value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for --${key}`);
      }
    }
    args[key] = value;
  }
  return args;
}

function num(value, name) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid number for --${name}: "${value}"`);
  }
  return n;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const ca = {
    balance: num(args.balance, 'balance'),
    initialLtv: num(args['initial-ltv'], 'initial-ltv'),
    maintenanceLtv: num(args['maintenance-ltv'], 'maintenance-ltv'),
    liquidationLtv: num(args['liquidation-ltv'], 'liquidation-ltv'),
  };
  const requirement = num(args.requirement, 'requirement');
  const price = num(args.price, 'price');
  const previousStatus = args.previous;
  const event = args.event;

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
  console.error('Error:', err.message);
  console.error(HELP);
  process.exit(1);
}
