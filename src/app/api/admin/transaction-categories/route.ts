import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import TransactionCategory from '@/models/TransactionCategory';
import { auth } from '@/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !(['admin', 'super_admin'].includes((session.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    await connectToDatabase();
    
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    
    // Ensure default categories exist if collection is empty
    const count = await TransactionCategory.countDocuments();
    if (count === 0) {
      const defaultCategories: { name: string; type: 'expense' | 'income' }[] = [
        { name: 'Receive Client Bill', type: 'income' },
        { name: 'Sales Income', type: 'income' },
        { name: 'Service Revenue', type: 'income' },
        { name: 'Investment / Capital', type: 'income' },
        { name: 'Refund Received', type: 'income' },
        { name: 'Others', type: 'income' },
        { name: 'Office Rent', type: 'expense' },
        { name: 'Utility & Electricity', type: 'expense' },
        { name: 'Salary & Allowance', type: 'expense' },
        { name: 'Marketing & Ads', type: 'expense' },
        { name: 'Office Supplies & Stationery', type: 'expense' },
        { name: 'Snacks & Refreshment', type: 'expense' },
        { name: 'Transport & Conveyance', type: 'expense' },
        { name: 'Equipment & Maintenance', type: 'expense' },
        { name: 'Software & Subscriptions', type: 'expense' },
        { name: 'Others', type: 'expense' },
      ];
      await TransactionCategory.insertMany(defaultCategories);
    }

    const query = type ? { type: type as 'expense' | 'income' } : {};
    const categories = await TransactionCategory.find(query).sort({ name: 1 }).lean();
    
    return NextResponse.json(categories, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching transaction categories:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !(['admin', 'super_admin'].includes((session.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    await connectToDatabase();
    const data = await req.json();
    
    if (!data.name || !data.type) {
      return NextResponse.json({ message: 'Name and type are required' }, { status: 400 });
    }
    
    // Check if it already exists
    const existing = await TransactionCategory.findOne({ 
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') }, 
      type: data.type 
    });
    
    if (existing) {
      return NextResponse.json({ message: `A category named "${data.name}" already exists for ${data.type}` }, { status: 400 });
    }
    
    const category = await TransactionCategory.create({
      name: data.name.trim(),
      type: data.type
    });
    
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transaction category:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
