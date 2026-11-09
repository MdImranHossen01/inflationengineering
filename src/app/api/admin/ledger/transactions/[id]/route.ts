import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import LedgerTransaction from '@/models/LedgerTransaction';
import { recalculateLedgerBalance } from '@/lib/ledgerHelper';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount, description, date } = body;

    await connectToDatabase();

    const tx = await LedgerTransaction.findById(id).populate('account');
    if (!tx) {
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }

    const isManual = tx.reference && ['manual-deposit', 'manual-withdrawal', 'manual-transfer'].includes(tx.reference);
    if (!isManual) {
      return NextResponse.json({ message: 'Only manual transactions can be edited' }, { status: 400 });
    }

    const accountCode = (tx.account as any).code;

    if (tx.reference === 'manual-transfer') {
      const timeWindow = 10000;
      const companion = await LedgerTransaction.findOne({
        reference: 'manual-transfer',
        amount: tx.amount,
        _id: { $ne: tx._id },
        createdAt: {
          $gte: new Date(tx.createdAt.getTime() - timeWindow),
          $lte: new Date(tx.createdAt.getTime() + timeWindow)
        }
      }).populate('account');

      const cleanDesc = description.replace(/^(Transfer to |Transfer from |Manual Deposit: |Manual Withdrawal: )/g, '');

      tx.amount = amount;
      tx.date = new Date(date);
      const toCode = companion ? (companion.account as any).code : 'BANK';
      const fromCode = companion ? (companion.account as any).code : 'CASH';
      tx.description = tx.type === 'credit' ? `Transfer to ${toCode}: ${cleanDesc}` : `Transfer from ${fromCode}: ${cleanDesc}`;
      await tx.save();
      await recalculateLedgerBalance(accountCode);

      if (companion) {
        companion.amount = amount;
        companion.date = new Date(date);
        companion.description = companion.type === 'credit' ? `Transfer to ${accountCode}: ${cleanDesc}` : `Transfer from ${accountCode}: ${cleanDesc}`;
        await companion.save();
        await recalculateLedgerBalance((companion.account as any).code);
      }
    } else {
      tx.amount = amount;
      tx.date = new Date(date);
      const cleanDesc = description.replace(/^(Transfer to |Transfer from |Manual Deposit: |Manual Withdrawal: )/g, '');
      const prefix = tx.type === 'debit' ? 'Manual Deposit' : 'Manual Withdrawal';
      tx.description = `${prefix}: ${cleanDesc}`;
      await tx.save();
      await recalculateLedgerBalance(accountCode);
    }

    return NextResponse.json({ message: 'Transaction updated successfully' });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const tx = await LedgerTransaction.findById(id).populate('account');
    if (!tx) {
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }

    const accountCode = (tx.account as any)?.code;

    if (tx.reference === 'manual-transfer') {
      const timeWindow = 10000;
      const companion = await LedgerTransaction.findOne({
        reference: 'manual-transfer',
        amount: tx.amount,
        _id: { $ne: tx._id },
        createdAt: {
          $gte: new Date(tx.createdAt.getTime() - timeWindow),
          $lte: new Date(tx.createdAt.getTime() + timeWindow)
        }
      }).populate('account');

      if (companion) {
        await LedgerTransaction.findByIdAndDelete(companion._id);
        if ((companion.account as any)?.code) {
          await recalculateLedgerBalance((companion.account as any).code);
        }
      }
    }

    await LedgerTransaction.findByIdAndDelete(id);
    if (accountCode) {
      await recalculateLedgerBalance(accountCode);
    }

    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
