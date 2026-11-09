import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Expense from '@/models/Expense';
import Bill from '@/models/Bill';
import LedgerTransaction from '@/models/LedgerTransaction';
import { recalculateLedgerBalance } from '@/lib/ledgerHelper';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
    const { title, amount, category, date, description, type, accountCode } = body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (category !== undefined) updateData.category = category;
    if (date !== undefined) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (accountCode !== undefined) updateData.accountCode = accountCode;

    await connectToDatabase();
    
    const expense = await Expense.findOneAndUpdate(
      { _id: id }, 
      updateData, 
      { new: true, runValidators: true }
    );

    if (!expense) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
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
    const { id } = await params;
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    await connectToDatabase();
    
    const expense = await Expense.findById(id);
    if (!expense) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 });
    }

    // If this was a client bill collection, revert the bill's paid amount & due
    if (expense.category === 'Receive Client Bill' || expense.bill || expense.invoiceNo) {
      try {
        let bill = null;
        if (expense.bill) bill = await Bill.findById(expense.bill);
        else if (expense.invoiceNo) bill = await Bill.findOne({ invoiceNo: expense.invoiceNo });

        if (bill) {
          const grandTotal = Math.round(bill.gTotal || bill.total || 0);
          bill.cashIn = Math.max(0, (bill.cashIn || 0) - expense.amount);
          bill.currentBillDue = Math.max(0, grandTotal - bill.cashIn);
          bill.status = bill.currentBillDue <= 0 ? 'Paid' : 'Due';
          await bill.save();
        }

        // Delete associated ledger entries
        const ref = expense.invoiceNo || expense.reference || id;
        await LedgerTransaction.deleteMany({ reference: ref });
        await recalculateLedgerBalance('AR');
        await recalculateLedgerBalance('CASH');
        await recalculateLedgerBalance('BANK');
      } catch (err) {
        console.error('Error reverting bill on income delete:', err);
      }
    } else {
      // General expense/income delete
      try {
        await LedgerTransaction.deleteMany({ reference: id });
        const acc = (expense.accountCode as any) || 'CASH';
        await recalculateLedgerBalance(acc);
      } catch (err) {
        console.error('Error removing ledger entries on expense delete:', err);
      }
    }

    await Expense.findByIdAndDelete(id);
    
    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
