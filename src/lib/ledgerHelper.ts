import connectToDatabase from '@/lib/db';
import LedgerAccount from '@/models/LedgerAccount';
import LedgerTransaction from '@/models/LedgerTransaction';

/**
 * Seed primary ledger accounts if they do not exist
 */
export async function seedLedgerAccounts() {
  await connectToDatabase();

  const accounts: { name: string; code: 'CASH' | 'BANK' | 'AR' | 'AP'; type: 'asset' | 'liability' }[] = [
    { name: 'Cash', code: 'CASH', type: 'asset' },
    { name: 'Bank', code: 'BANK', type: 'asset' },
    { name: 'Accounts Receivable', code: 'AR', type: 'asset' },
    { name: 'Accounts Payable', code: 'AP', type: 'liability' },
  ];

  for (const acc of accounts) {
    const exists = await LedgerAccount.findOne({ code: acc.code });
    if (!exists) {
      await LedgerAccount.create({
        name: acc.name,
        code: acc.code,
        type: acc.type,
        openingBalance: 0,
        currentBalance: 0,
      });
    }
  }
}

/**
 * Log a transaction to the ledger
 */
export async function logLedgerTransaction(
  accountCode: 'CASH' | 'BANK' | 'AR' | 'AP',
  type: 'debit' | 'credit',
  amount: number,
  description: string,
  reference?: string,
  date: Date = new Date()
) {
  await connectToDatabase();
  await seedLedgerAccounts();

  // Find account
  const account = await LedgerAccount.findOne({ code: accountCode });
  if (!account) {
    throw new Error(`Ledger account not found with code: ${accountCode}`);
  }

  // Calculate balanceAfter
  // For assets: debit increases, credit decreases
  // For liabilities: credit increases, debit decreases
  const change = account.type === 'liability'
    ? (type === 'credit' ? amount : -amount)
    : (type === 'debit' ? amount : -amount);
  const balanceAfter = account.currentBalance + change;

  // Create transaction
  const transaction = new LedgerTransaction({
    account: account._id,
    date,
    description,
    type,
    amount,
    reference,
    balanceAfter,
  });

  await transaction.save();

  // Update current account balance
  account.currentBalance = balanceAfter;
  await account.save();

  // Recalculate to keep chronological order correct in the DB running balances
  await recalculateLedgerBalance(accountCode);

  return transaction;
}

/**
 * Recalculate ledger balance for an account
 */
export async function recalculateLedgerBalance(accountCode: 'CASH' | 'BANK' | 'AR' | 'AP') {
  await connectToDatabase();
  const account = await LedgerAccount.findOne({ code: accountCode });
  if (!account) return;

  const transactions = await LedgerTransaction.find({ account: account._id }).sort({ date: 1, createdAt: 1 });

  let runningBalance = account.openingBalance || 0;

  for (const tx of transactions) {
    const change = account.type === 'liability'
      ? (tx.type === 'credit' ? tx.amount : -tx.amount)
      : (tx.type === 'debit' ? tx.amount : -tx.amount);
    runningBalance += change;
    tx.balanceAfter = runningBalance;
    await tx.save();
  }

  account.currentBalance = runningBalance;
  await account.save();
}

/**
 * Log order payment to the ledger
 */
export async function logOrderPaymentToLedger(order: any) {
  try {
    await connectToDatabase();

    // Determine account code based on paymentMethod
    // Online -> BANK, others (COD, Manual) -> CASH
    const accountCode = order.paymentMethod === 'Online' ? 'BANK' : 'CASH';

    const amount = order.totalAmount || 0;
    const orderIdStr = order._id.toString();
    const shortId = orderIdStr.slice(-8).toUpperCase();

    const description = `Customer payment received for Order #${shortId}`;
    const reference = `ORDER-${shortId}`;

    // Ensure idempotency: check if transaction with this reference already exists
    const exists = await LedgerTransaction.findOne({ reference });
    if (exists) {
      console.log(`[Ledger] Entry already exists for order reference: ${reference}`);
      return;
    }

    await logLedgerTransaction(
      accountCode,
      'debit', // Debit increases Cash or Bank
      amount,
      description,
      reference,
      order.createdAt ? new Date(order.createdAt) : new Date()
    );
    console.log(`[Ledger] Logged payment for Order #${shortId} to ${accountCode} successfully.`);
  } catch (error) {
    console.error('[Ledger] Error logging order payment to ledger:', error);
  }
}

/**
 * Sync active bills to ledger: ensures Bill Generated AR debit entry and upfront cash entries exist.
 */
export async function syncBillsToLedger() {
  try {
    await connectToDatabase();
    const Bill = (await import('@/models/Bill')).default;
    const LedgerAccount = (await import('@/models/LedgerAccount')).default;
    const arAccount = await LedgerAccount.findOne({ code: 'AR' });
    const cashAccount = await LedgerAccount.findOne({ code: 'CASH' });

    if (!arAccount || !cashAccount) return;

    const bills = await Bill.find({
      $or: [{ documentType: 'bill' }, { documentType: { $exists: false } }]
    });

    for (const bill of bills) {
      if (!bill.invoiceNo) continue;

      const billDate = bill.date ? new Date(bill.date) : (bill.createdAt ? new Date(bill.createdAt) : new Date());

      // 1. Check AR Debit entry for Bill Generated
      const billDebitExists = await LedgerTransaction.findOne({
        account: arAccount._id,
        reference: bill.invoiceNo,
        type: 'debit'
      });

      if (!billDebitExists && bill.gTotal > 0) {
        await logLedgerTransaction(
          'AR',
          'debit',
          bill.gTotal,
          `Bill Generated for ${bill.clientName}`,
          bill.invoiceNo,
          billDate
        );
      } else if (billDebitExists && bill.gTotal > 0) {
        // If the debit exists but has wrong/later date, sync the date to bill's actual creation date
        if (new Date(billDebitExists.date).getTime() > billDate.getTime()) {
          billDebitExists.date = billDate;
          await billDebitExists.save();
        }
      }

      // 2. Check Upfront payment if cashIn > 0
      if (bill.cashIn > 0) {
        const bankAccount = await LedgerAccount.findOne({ code: 'BANK' });
        const paymentAccountIds: any[] = [];
        if (cashAccount?._id) paymentAccountIds.push(cashAccount._id);
        if (bankAccount?._id) paymentAccountIds.push(bankAccount._id);

        // Find all payment debit transactions already logged for this bill (in CASH or BANK)
        const existingPaymentTxs = await LedgerTransaction.find({
          account: { $in: paymentAccountIds },
          reference: bill.invoiceNo,
          type: 'debit',
          description: { $not: /Bill Generated/i }
        });

        const totalAlreadyLogged = existingPaymentTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const unloggedCash = (bill.cashIn || 0) - totalAlreadyLogged;

        if (unloggedCash > 0) {
          await logLedgerTransaction(
            'CASH',
            'debit',
            unloggedCash,
            `Cash Paid Upfront for Bill ${bill.invoiceNo}`,
            bill.invoiceNo,
            billDate
          );

          await logLedgerTransaction(
            'AR',
            'credit',
            unloggedCash,
            `Upfront payment credit for Bill ${bill.invoiceNo}`,
            bill.invoiceNo,
            billDate
          );
        }
      }
    }

    await recalculateLedgerBalance('AR');
    await recalculateLedgerBalance('CASH');
  } catch (err) {
    console.error('[Ledger] Error syncing bills to ledger:', err);
  }
}

/**
 * Clean up orphan ledger transactions for deleted bills, expenses, orders, etc.
 * and recalculate balances automatically.
 */
export async function cleanOrphanLedgerTransactions() {
  try {
    await connectToDatabase();
    const Bill = (await import('@/models/Bill')).default;
    const Expense = (await import('@/models/Expense')).default;
    const Order = (await import('@/models/Order')).default;
    const SupplierBill = (await import('@/models/SupplierBill')).default;
    const mongoose = (await import('mongoose')).default;

    const transactions = await LedgerTransaction.find();
    let deletedCount = 0;

    for (const tx of transactions) {
      // 1. Check Client Bill references: INV-xxxxxxx
      if (tx.reference && tx.reference.startsWith('INV-')) {
        const billExists = await Bill.findOne({ invoiceNo: tx.reference });
        if (!billExists) {
          await LedgerTransaction.findByIdAndDelete(tx._id);
          deletedCount++;
          continue;
        }
      }

      // 2. Check description containing INV- or Bill numbers
      if (tx.description && (/INV-\d+/i.test(tx.description) || /Bill\s+(\w+)/i.test(tx.description))) {
        const match = tx.description.match(/INV-\d+/i) || tx.description.match(/Bill\s+(\w+)/i);
        if (match) {
          const invNo = match[0].replace(/^Bill\s+/i, '').toUpperCase();
          const billExists = await Bill.findOne({
            $or: [
              { invoiceNo: invNo },
              { invoiceNo: `INV-${invNo}` },
              { invoiceNo: new RegExp(invNo, 'i') }
            ]
          });
          if (!billExists) {
            await LedgerTransaction.findByIdAndDelete(tx._id);
            deletedCount++;
            continue;
          }
        }
      }

      // 3. Check Expense/Income ObjectId references (24 hex characters)
      if (tx.reference && mongoose.Types.ObjectId.isValid(tx.reference) && tx.reference.length === 24) {
        const expenseExists = await Expense.findById(tx.reference);
        const billExists = await Bill.findById(tx.reference);
        const orderExists = await Order.findById(tx.reference);
        const supplierBillExists = await SupplierBill.findById(tx.reference);

        if (!expenseExists && !billExists && !orderExists && !supplierBillExists) {
          await LedgerTransaction.findByIdAndDelete(tx._id);
          deletedCount++;
          continue;
        }
      }
    }

    // Clean orphan Expense/Income records linked to non-existent bills or supplier bills
    const allExpenses = await Expense.find({
      $or: [
        { bill: { $exists: true, $ne: null } },
        { invoiceNo: { $exists: true, $ne: null } },
        { supplierBill: { $exists: true, $ne: null } },
        { reference: { $regex: /^INV-|^SB-|^PB-/i } },
        { title: { $regex: /INV-\d+|SB-\d+|PB-\d+/i } }
      ]
    });

    for (const exp of allExpenses) {
      let isOrphan = false;

      // Check client bill links
      if (exp.bill) {
        const bill = await Bill.findById(exp.bill);
        if (!bill) isOrphan = true;
      } else if (exp.invoiceNo && exp.invoiceNo.startsWith('INV-')) {
        const bill = await Bill.findOne({ invoiceNo: exp.invoiceNo });
        if (!bill) isOrphan = true;
      } else if (exp.reference && exp.reference.startsWith('INV-')) {
        const bill = await Bill.findOne({ invoiceNo: exp.reference });
        if (!bill) isOrphan = true;
      } else if (exp.title && /INV-\d+/i.test(exp.title)) {
        const match = exp.title.match(/INV-\d+/i);
        if (match) {
          const bill = await Bill.findOne({ invoiceNo: match[0].toUpperCase() });
          if (!bill) isOrphan = true;
        }
      }

      // Check supplier bill links
      if (exp.supplierBill) {
        const sb = await SupplierBill.findById(exp.supplierBill);
        if (!sb) isOrphan = true;
      }

      if (isOrphan) {
        await Expense.findByIdAndDelete(exp._id);
        deletedCount++;
      }
    }

    // Sync active bills to ensure missing initial AR debits are generated
    await syncBillsToLedger();

    // Recalculate all accounts
    await recalculateLedgerBalance('CASH');
    await recalculateLedgerBalance('BANK');
    await recalculateLedgerBalance('AR');
    await recalculateLedgerBalance('AP');

    return deletedCount;
  } catch (err) {
    console.error('[Ledger] Error auto-cleaning orphan transactions:', err);
    return 0;
  }
}

