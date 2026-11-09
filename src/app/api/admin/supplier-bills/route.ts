import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import SupplierBill from '@/models/SupplierBill';
import Supplier from '@/models/Supplier';
import { logLedgerTransaction } from '@/lib/ledgerHelper';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const bills = await SupplierBill.find({}).populate('supplier', 'name phone companyName').sort({ createdAt: -1 });
    return NextResponse.json(bills);
  } catch (error: any) {
    console.error('Error fetching supplier bills:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

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

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    // Generate sequential bill number SB-0000101 or use custom one if provided
    let billNo = body.customBillNo || body.billNo;
    if (!billNo) {
      const lastBill = await SupplierBill.findOne({}).sort({ createdAt: -1 });
      let nextNum = 101;
      if (lastBill && lastBill.billNo) {
        const match = lastBill.billNo.match(/\d+/);
        if (match) {
          nextNum = parseInt(match[0], 10) + 1;
        }
      }
      billNo = `SB-${String(nextNum).padStart(7, '0')}`;
    }

    const parsedDate = date ? new Date(date) : new Date();
    const paid = paidAmount || 0;
    const dueAmount = total - paid;
    let status: 'Paid' | 'Partially Paid' | 'Due' = 'Due';
    if (paid >= total) status = 'Paid';
    else if (paid > 0) status = 'Partially Paid';

    const newBill = new SupplierBill({
      supplier: supplierId,
      billNo,
      date: parsedDate,
      items,
      subtotal,
      discount: discount || 0,
      total,
      paidAmount: paid,
      dueAmount,
      status,
      paymentMethod: paid > 0 ? (paymentMethod || 'Cash') : undefined
    });

    await newBill.save();

    // Update Supplier's outstanding payable balance (our liability increases by the due amount)
    supplier.currentBalance += dueAmount;
    await supplier.save();

    // Log to Ledger System
    try {
      // 1. Credit Accounts Payable (AP) - increases liability by the total purchase amount
      await logLedgerTransaction(
        'AP',
        'credit',
        total,
        `Purchase Bill ${billNo} from ${supplier.name}`,
        supplierId,
        parsedDate
      );

      // 2. If upfront cash was paid
      if (paid > 0) {
        // Debit Accounts Payable (AP) - decreases liability by the paid amount
        await logLedgerTransaction(
          'AP',
          'debit',
          paid,
          `Upfront payment for Purchase Bill ${billNo}`,
          supplierId,
          parsedDate
        );

        // Credit CASH or BANK - decreases cash asset by the paid amount
        await logLedgerTransaction(
          paymentMethod === 'Bank' ? 'BANK' : 'CASH',
          'credit',
          paid,
          `Upfront payment for Purchase Bill ${billNo}`,
          supplierId,
          parsedDate
        );
      }
    } catch (err) {
      console.error('Error logging purchase to ledger:', err);
    }

    return NextResponse.json(newBill, { status: 201 });
  } catch (error: any) {
    console.error('Error creating supplier bill:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
