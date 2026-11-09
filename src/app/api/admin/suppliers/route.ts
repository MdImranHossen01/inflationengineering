import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Supplier from '@/models/Supplier';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const suppliers = await Supplier.find({}).sort({ createdAt: -1 });
    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
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
    const { name, phone, email, address, companyName } = body;

    if (!name || !phone || !address) {
      return NextResponse.json({ message: 'Name, phone, and address are required' }, { status: 400 });
    }

    await connectToDatabase();

    const newSupplier = new Supplier({
      name,
      phone,
      email,
      address,
      companyName,
      currentBalance: 0
    });

    await newSupplier.save();
    return NextResponse.json(newSupplier, { status: 201 });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
