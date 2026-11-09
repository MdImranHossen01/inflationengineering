import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import SupplierBill from '@/models/SupplierBill';
import Supplier from '@/models/Supplier';
import LedgerTransaction from '@/models/LedgerTransaction';
import { logLedgerTransaction, recalculateLedgerBalance } from '@/lib/ledgerHelper';

export async function GET(
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

    const bill = await SupplierBill.findById(id).populate('supplier', 'name phone companyName');
    if (!bill) {
      return NextResponse.json({ message: 'Supplier bill not found' }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error: any) {
    console.error('Error fetching supplier bill:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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
    const {
      supplierId,
      date,
      items,
      subtotal,
      discount,
      total,
      paidAmount,
      paymentMethod
    } = body;

    if (!supplierId || !items || items.length === 0 || total === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const bill = await SupplierBill.findById(id);
    if (!bill) {
      return NextResponse.json({ message: 'Supplier bill not found' }, { status: 404 });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    const oldDueAmount = bill.dueAmount;
    const oldSupplierId = bill.supplier.toString();

    const parsedDate = date ? new Date(date) : bill.date;
    const paid = paidAmount || 0;
    const dueAmount = total - paid;
    let status: 'Paid' | 'Partially Paid' | 'Due' = 'Due';
    if (paid >= total) status = 'Paid';
    else if (paid > 0) status = 'Partially Paid';

    // Update bill fields
    bill.supplier = supplierId;
    bill.date = parsedDate;
    bill.items = items;
    bill.subtotal = subtotal;
    bill.discount = discount || 0;
    bill.total = total;
    bill.paidAmount = paid;
    bill.dueAmount = dueAmount;
    bill.status = status;
    bill.paymentMethod = paid > 0 ? (paymentMethod || 'Cash') : undefined;

    await bill.save();

    // Adjust supplier outstanding balances
    if (oldSupplierId === supplierId) {
      supplier.currentBalance += (dueAmount - oldDueAmount);
      await supplier.save();
    } else {
      // Revert old supplier balance
      const oldSupplier = await Supplier.findById(oldSupplierId);
      if (oldSupplier) {
        oldSupplier.currentBalance -= oldDueAmount;
        await oldSupplier.save();
      }
      // Add to new supplier balance
      supplier.currentBalance += dueAmount;
      await supplier.save();
    }

    // Update Ledger Transactions:
    // Delete previous transactions containing the billNo in their description, then recreate them
    try {
      await LedgerTransaction.deleteMany({ description: { $regex: bill.billNo } });

      // 1. Credit Accounts Payable (AP)
      await logLedgerTransaction(
        'AP',
        'credit',
        total,
        `Purchase Bill ${bill.billNo} from ${supplier.name}`,
        supplierId,
        parsedDate
      );

      // 2. If upfront cash was paid
      if (paid > 0) {
        await logLedgerTransaction(
          'AP',
          'debit',
          paid,
          `Upfront payment for Purchase Bill ${bill.billNo}`,
          supplierId,
          parsedDate
        );

        await logLedgerTransaction(
          paymentMethod === 'Bank' ? 'BANK' : 'CASH',
          'credit',
          paid,
          `Upfront payment for Purchase Bill ${bill.billNo}`,
          supplierId,
          parsedDate
        );
      }

      // Recalculate balances
      await recalculateLedgerBalance('AP');
      await recalculateLedgerBalance('CASH');
      await recalculateLedgerBalance('BANK');
    } catch (err) {
      console.error('Error updating ledger for purchase bill:', err);
    }

    return NextResponse.json(bill);
  } catch (error: any) {
    console.error('Error updating supplier bill:', error);
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

    const bill = await SupplierBill.findById(id);
    if (!bill) {
      return NextResponse.json({ message: 'Supplier bill not found' }, { status: 404 });
    }

    const supplier = await Supplier.findById(bill.supplier);
    if (supplier) {
      supplier.currentBalance -= bill.dueAmount;
      await supplier.save();
    }

    // Delete associated ledger transactions
    try {
      await LedgerTransaction.deleteMany({ description: { $regex: bill.billNo } });
      await recalculateLedgerBalance('AP');
      await recalculateLedgerBalance('CASH');
      await recalculateLedgerBalance('BANK');
    } catch (err) {
      console.error('Error removing ledger transactions:', err);
    }

    // Delete associated Expense entries for this supplier bill
    try {
      const Expense = (await import('@/models/Expense')).default;
      await Expense.deleteMany({
        $or: [
          { supplierBill: bill._id },
          { reference: bill.billNo },
          { title: { $regex: bill.billNo, $options: 'i' } },
          { description: { $regex: bill.billNo, $options: 'i' } }
        ]
      });
    } catch (err) {
      console.error('Error removing expense entries for supplier bill:', err);
    }

    await SupplierBill.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Supplier bill deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier bill:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
