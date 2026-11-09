import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Expense from '@/models/Expense';
import Bill from '@/models/Bill';
import SupplierBill from '@/models/SupplierBill';
import Supplier from '@/models/Supplier';
import { logLedgerTransaction, recalculateLedgerBalance, cleanOrphanLedgerTransactions } from '@/lib/ledgerHelper';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    await cleanOrphanLedgerTransactions();
    
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const query: any = {};
    if (category) query.category = category;
    if (type) query.type = type;
    
    if (from || to) {
      const dateQuery: any = {};
      
      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return NextResponse.json({ message: 'Invalid "from" date format' }, { status: 400 });
        }
        dateQuery.$gte = fromDate;
      }
      
      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return NextResponse.json({ message: 'Invalid "to" date format' }, { status: 400 });
        }
        dateQuery.$lte = toDate;
      }
      
      query.date = dateQuery;
    }

    const expenses = await Expense.find(query)
      .populate({ path: 'bill', strictPopulate: false })
      .populate({ path: 'supplier', select: 'name phone companyName', strictPopulate: false })
      .populate({ path: 'supplierBill', strictPopulate: false })
      .sort({ date: -1, createdAt: -1 });
    return NextResponse.json(expenses);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
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
      title,
      amount,
      category,
      date,
      description,
      type,
      accountCode = 'CASH',
      billId,
      invoiceNo,
      supplierId,
      supplierBillId
    } = body;

    const numAmount = Number(amount);
    if (!title || isNaN(numAmount) || numAmount <= 0 || !category || !type) {
      return NextResponse.json({ message: 'Missing or invalid required fields' }, { status: 400 });
    }

    await connectToDatabase();
    const txDate = date ? new Date(date) : new Date();

    // SPECIAL HANDLER 1: Receive Client Bill (Income)
    if (type === 'income' && (category === 'Receive Client Bill' || billId || invoiceNo)) {
      let bill = null;
      if (billId) {
        bill = await Bill.findById(billId);
      } else if (invoiceNo) {
        bill = await Bill.findOne({ invoiceNo });
      }

      if (bill) {
        const billInv = bill.invoiceNo;
        const prevCashIn = bill.cashIn || 0;
        const newCashIn = prevCashIn + numAmount;
        const grandTotal = Math.round(bill.gTotal || bill.total || 0);
        const newDue = Math.max(0, grandTotal - newCashIn);

        bill.cashIn = newCashIn;
        bill.currentBillDue = newDue;
        if (newDue <= 0) {
          bill.status = 'Paid';
          bill.expectedReceivableDate = undefined;
        }
        await bill.save();

        const expense = await Expense.create({
          title,
          amount: numAmount,
          category: 'Receive Client Bill',
          type: 'income',
          date: txDate,
          description: description || `Client bill payment received for ${billInv}`,
          reference: billInv,
          bill: bill._id,
          invoiceNo: billInv,
          accountCode: accountCode || 'CASH'
        });

        // Log double entry to Ledger
        try {
          await logLedgerTransaction(
            accountCode as any || 'CASH',
            'debit',
            numAmount,
            `Payment Received for Bill ${billInv}`,
            billInv,
            txDate
          );

          await logLedgerTransaction(
            'AR',
            'credit',
            numAmount,
            `Payment credit for Bill ${billInv}`,
            billInv,
            txDate
          );
        } catch (err) {
          console.error('Error logging client bill payment to ledger:', err);
        }

        const populatedExpense = await Expense.findById(expense._id).populate({ path: 'bill', strictPopulate: false });
        return NextResponse.json({ ...(populatedExpense ? populatedExpense.toObject() : expense.toObject()), billData: bill }, { status: 201 });
      }
    }

    // SPECIAL HANDLER 2: Supplier Bill Payment (Expense)
    if (type === 'expense' && (supplierBillId || supplierId || category === 'Supplier Bill Payment' || category === 'Account payable')) {
      let supBill = null;
      if (supplierBillId) {
        supBill = await SupplierBill.findById(supplierBillId);
      }

      if (supBill) {
        const prevPaid = supBill.paidAmount || 0;
        const newPaid = prevPaid + numAmount;
        const total = supBill.total || 0;
        const newDue = Math.max(0, total - newPaid);

        supBill.paidAmount = newPaid;
        supBill.dueAmount = newDue;
        supBill.status = newDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Due');
        await supBill.save();

        const expense = await Expense.create({
          title,
          amount: numAmount,
          category: category || 'Supplier Bill Payment',
          type: 'expense',
          date: txDate,
          description: description || `Supplier bill payment for #${supBill.billNo}`,
          reference: supBill.billNo,
          supplierBill: supBill._id,
          supplier: supBill.supplier,
          accountCode: accountCode || 'CASH'
        });

        try {
          await logLedgerTransaction(
            'AP',
            'debit',
            numAmount,
            `Supplier Bill Payment ${supBill.billNo}`,
            supBill.billNo,
            txDate
          );

          await logLedgerTransaction(
            accountCode as any || 'CASH',
            'credit',
            numAmount,
            `Supplier Bill Payment ${supBill.billNo}`,
            supBill.billNo,
            txDate
          );
        } catch (err) {
          console.error('Error logging supplier bill payment to ledger:', err);
        }

        const populatedExpense = await Expense.findById(expense._id)
          .populate({ path: 'supplier', strictPopulate: false })
          .populate({ path: 'supplierBill', strictPopulate: false });
        return NextResponse.json(populatedExpense || expense, { status: 201 });
      } else if (supplierId) {
        const expense = await Expense.create({
          title,
          amount: numAmount,
          category: category || 'Supplier Bill Payment',
          type: 'expense',
          date: txDate,
          description: description || 'Payment to supplier',
          supplier: supplierId,
          accountCode: accountCode || 'CASH'
        });

        try {
          await logLedgerTransaction(
            'AP',
            'debit',
            numAmount,
            `Payment to supplier: ${title}`,
            expense._id.toString(),
            txDate
          );

          await logLedgerTransaction(
            accountCode as any || 'CASH',
            'credit',
            numAmount,
            `Payment to supplier: ${title}`,
            expense._id.toString(),
            txDate
          );
        } catch (err) {
          console.error('Error logging supplier payment to ledger:', err);
        }

        const populatedExpense = await Expense.findById(expense._id).populate({ path: 'supplier', strictPopulate: false });
        return NextResponse.json(populatedExpense || expense, { status: 201 });
      }
    }

    // GENERAL HANDLER: Standard Expense or Income
    const expense = await Expense.create({
      title,
      amount: numAmount,
      category,
      type,
      date: txDate,
      description,
      accountCode: accountCode || 'CASH'
    });

    // Log to ledger
    try {
      if (type === 'expense') {
        await logLedgerTransaction(
          accountCode as any || 'CASH',
          'credit',
          numAmount,
          `Expense Paid: ${title}`,
          expense._id.toString(),
          txDate
        );
      } else {
        await logLedgerTransaction(
          accountCode as any || 'CASH',
          'debit',
          numAmount,
          `Income Received: ${title}`,
          expense._id.toString(),
          txDate
        );
      }
    } catch (err) {
      console.error('Error logging transaction to ledger:', err);
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
