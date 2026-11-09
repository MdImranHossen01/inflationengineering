/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Bill from '@/models/Bill';
import LedgerTransaction from '@/models/LedgerTransaction';
import LedgerAccount from '@/models/LedgerAccount';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    void LedgerAccount;

    const bill = await Bill.findById(id).lean();
    if (!bill) {
      return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    }

    // Find all ledger transactions matching this bill's invoice number
    const transactions = await LedgerTransaction.find({
      reference: bill.invoiceNo
    })
      .populate('account')
      .sort({ date: 1, _id: 1 })
      .lean();

    // Extract installment payment entries
    // In our double-entry ledger, every payment to a bill is logged as:
    // 1) Debit on CASH or BANK account (cash asset increase)
    // 2) Credit on AR account (receivable decrease)
    let paymentTxs = transactions.filter((tx: any) => {
      const code = tx.account?.code;
      return (code === 'CASH' || code === 'BANK') && tx.type === 'debit';
    });

    // Fallback if no CASH debit found, check AR credit entries
    if (paymentTxs.length === 0) {
      paymentTxs = transactions.filter((tx: any) => tx.type === 'credit');
    }

    let runningPaid = 0;
    const installments = paymentTxs.map((tx: any, idx: number) => {
      runningPaid += tx.amount;
      const remainingDue = Math.max(0, (bill.gTotal || 0) - runningPaid);
      return {
        installmentNo: idx + 1,
        txId: tx._id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        method: tx.account?.name || (tx.type === 'debit' ? 'Cash' : 'Account Credit'),
        accountCode: tx.account?.code || 'CASH',
        cumulativePaid: runningPaid,
        remainingDueAfter: remainingDue
      };
    });

    // If bill has cashIn recorded but no ledger transactions exist (e.g. legacy bill)
    if (installments.length === 0 && (bill.cashIn || 0) > 0) {
      installments.push({
        installmentNo: 1,
        txId: bill._id,
        date: bill.date || bill.createdAt,
        amount: bill.cashIn,
        description: 'Recorded Cash Payment',
        method: 'Cash',
        accountCode: 'CASH',
        cumulativePaid: bill.cashIn,
        remainingDueAfter: bill.currentBillDue || 0
      });
    }

    // Sort with latest installment on top
    installments.reverse();

    return NextResponse.json({
      bill,
      installments,
      rawTransactions: transactions
    });
  } catch (error: any) {
    console.error('Error fetching bill transaction history:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
