import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectToDatabase from '../src/lib/db';
import { recalculateLedgerBalance } from '../src/lib/ledgerHelper';

async function main() {
  await connectToDatabase();
  console.log('Recalculating CASH...');
  await recalculateLedgerBalance('CASH');
  console.log('Recalculating BANK...');
  await recalculateLedgerBalance('BANK');
  console.log('Recalculating AR...');
  await recalculateLedgerBalance('AR');
  console.log('Recalculating AP...');
  await recalculateLedgerBalance('AP');
  console.log('Recalculation complete!');
  process.exit(0);
}

main();
