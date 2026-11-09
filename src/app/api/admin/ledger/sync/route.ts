import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import LedgerTransaction from '@/models/LedgerTransaction';
import Bill from '@/models/Bill';
import Expense from '@/models/Expense';
import SupplierBill from '@/models/SupplierBill';
import Order from '@/models/Order';
import { recalculateLedgerBalance } from '@/lib/ledgerHelper';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { cleanOrphanLedgerTransactions } = await import('@/lib/ledgerHelper');
    const deletedCount = await cleanOrphanLedgerTransactions();

    return NextResponse.json({
      success: true,
      message: `Ledger synchronized successfully! Auto-synced active bills and removed ${deletedCount} orphan transaction(s).`,
      deletedCount
    });
  } catch (error: any) {
    console.error('Error syncing ledger:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
