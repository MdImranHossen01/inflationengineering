const mongoose = require('mongoose');

const uri = "mongodb://InflationEngineering:RU4lcYpnYurjZfSd@ac-jrowhop-shard-00-00.e5n1hnl.mongodb.net:27017,ac-jrowhop-shard-00-01.e5n1hnl.mongodb.net:27017,ac-jrowhop-shard-00-02.e5n1hnl.mongodb.net:27017/InflationEngineering?ssl=true&replicaSet=atlas-qnqnrr-shard-0&authSource=admin&retryWrites=true&w=majority";

(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const LedgerTransaction = mongoose.models.LedgerTransaction || mongoose.model('LedgerTransaction', new mongoose.Schema({}, { strict: false }));
    const LedgerAccount = mongoose.models.LedgerAccount || mongoose.model('LedgerAccount', new mongoose.Schema({}, { strict: false }));
    const Bill = mongoose.models.Bill || mongoose.model('Bill', new mongoose.Schema({}, { strict: false }));

    const bills = await Bill.find();
    console.log('=== BILLS IN DB ===');
    for (const b of bills) {
      console.log(`Invoice: ${b.invoiceNo}, gTotal: ${b.gTotal}, cashIn: ${b.cashIn}, due: ${b.currentBillDue}, status: ${b.status}`);
    }

    const accounts = await LedgerAccount.find();
    console.log('=== ACCOUNTS ===');
    const accMap = {};
    for (const a of accounts) {
      accMap[a._id.toString()] = a;
      console.log(`Acc: ${a.name} (${a.code}), Bal: ${a.currentBalance}, Opening: ${a.openingBalance}`);
    }

    const txs = await LedgerTransaction.find().sort({ date: 1, createdAt: 1 });
    console.log('=== TRANSACTIONS (Chronological) ===');
    for (const t of txs) {
      const acc = accMap[t.account?.toString()];
      console.log(`Date: ${t.date?.toISOString()?.slice(0,10)} | Acc: ${acc?.name} (${acc?.code}) | Type: ${t.type} | Amount: ${t.amount} | BalAfter: ${t.balanceAfter} | Desc: ${t.description} | Ref: ${t.reference}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
