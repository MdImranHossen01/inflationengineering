import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Supplier from '@/models/Supplier';
import SupplierBill from '@/models/SupplierBill';
import LedgerTransaction from '@/models/LedgerTransaction';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    // Fetch all bills for this supplier
    const bills = await SupplierBill.find({ supplier: id }).sort({ date: -1 });

    // Fetch all ledger transactions (payments/adjustments) related to this supplier
    const payments = await LedgerTransaction.find({ reference: id }).sort({ date: -1 });

    return NextResponse.json({
      supplier,
      bills,
      payments
    });
  } catch (error: any) {
    console.error('Error fetching supplier details:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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

    const body = await req.json();
    const { name, phone, email, address, companyName } = body;

    await connectToDatabase();

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    if (name) supplier.name = name;
    if (phone) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (address) supplier.address = address;
    if (companyName !== undefined) supplier.companyName = companyName;

    await supplier.save();
    return NextResponse.json(supplier);
  } catch (error: any) {
    console.error('Error updating supplier:', error);
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

    await connectToDatabase();

    // Check if supplier has any bills
    const billsCount = await SupplierBill.countDocuments({ supplier: id });
    if (billsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete supplier with active transaction history/bills' },
        { status: 400 }
      );
    }

    const deleted = await Supplier.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
