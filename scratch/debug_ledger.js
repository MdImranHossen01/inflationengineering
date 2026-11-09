import connectToDatabase from '../src/lib/db.js';
import LedgerTransaction from '../src/models/LedgerTransaction.js';
import LedgerAccount from '../src/models/LedgerAccount.js';

async function main() {
  await connectToDatabase();
  const cashAcc = await LedgerAccount.findOne({ code: 'CASH' });
  if (!cashAcc) {
    console.log('Cash account not found');
    return;
  }
  const txs = await LedgerTransaction.find({ account: cashAcc._id }).sort({ date: 1, createdAt: 1 });
  console.log('--- CASH TRANSACTIONS (Chronological) ---');
  txs.forEach(tx => {
    console.log(`${tx.date.toISOString()} | ${tx.description} | ${tx.type} | Amt: ${tx.amount} | Bal: ${tx.balanceAfter} | Created: ${tx.createdAt.toISOString()}`);
  });
  process.exit(0);
}

main();
