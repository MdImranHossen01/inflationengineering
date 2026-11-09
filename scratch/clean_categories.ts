import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectToDatabase from '../src/lib/db';
import LedgerTransaction from '../src/models/LedgerTransaction';

async function main() {
  await connectToDatabase();
  
  const txs = await LedgerTransaction.find();
  let count = 0;
  for (const tx of txs) {
    if (tx.description && tx.description.includes('(') && tx.description.endsWith(')')) {
      const cleanDesc = tx.description.replace(/\s\([^)]+\)$/, '');
      console.log(`Updating description: "${tx.description}" -> "${cleanDesc}"`);
      tx.description = cleanDesc;
      await tx.save();
      count++;
    }
  }
  console.log(`Cleaned up ${count} transactions!`);
  process.exit(0);
}

main();
