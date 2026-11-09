import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Supplier from '@/models/Supplier';
import { logLedgerTransaction } from '@/lib/ledgerHelper';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, paymentMethod, description, date } = body;

    if (!amount || amount <= 0 || !paymentMethod) {
      return NextResponse.json({ message: 'Amount and payment method are required' }, { status: 400 });
    }

    await connectToDatabase();

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    // Update supplier balance (liability decreases)
    supplier.currentBalance -= amount;
    await supplier.save();

    // Log ledger transactions
    const paymentDate = date ? new Date(date) : new Date();

    // 1. Debit Accounts Payable (AP) - liability decreases
    await logLedgerTransaction(
      'AP',
      'debit',
      amount,
      description || `Payment made to Supplier: ${supplier.name}`,
      id,
      paymentDate
    );

    // 2. Credit CASH or BANK - asset decreases
    await logLedgerTransaction(
      paymentMethod === 'Bank' ? 'BANK' : 'CASH',
      'credit',
      amount,
      description || `Payment made to Supplier: ${supplier.name}`,
      id,
      paymentDate
    );

    return NextResponse.json({
      message: 'Payment recorded successfully',
      currentBalance: supplier.currentBalance
    });
  } catch (error: any) {
    console.error('Error recording supplier payment:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
