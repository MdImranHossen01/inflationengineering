import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import TransactionCategory from '@/models/TransactionCategory';
import { auth } from '@/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user || !(['admin', 'super_admin'].includes((session.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();

    if (!data.name || !data.type) {
      return NextResponse.json({ message: 'Name and type are required' }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await TransactionCategory.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
      type: data.type,
    });

    if (existing) {
      return NextResponse.json({ message: `A category named "${data.name}" already exists for ${data.type}` }, { status: 400 });
    }

    const updated = await TransactionCategory.findByIdAndUpdate(
      id,
      { name: data.name.trim(), type: data.type },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating transaction category:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user || !(['admin', 'super_admin'].includes((session.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const deleted = await TransactionCategory.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting transaction category:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
