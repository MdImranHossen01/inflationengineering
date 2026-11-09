/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectToDatabase from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import Expense from '@/models/Expense';
import Bill from '@/models/Bill';
import SupplierBill from '@/models/SupplierBill';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(['admin', 'super_admin'].includes((session?.user as any)?.role))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Default range: Last 30 days
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const defaultTo = new Date();

    let startDate = defaultFrom;
    if (from) {
      const parsedFrom = new Date(from);
      if (!isNaN(parsedFrom.getTime())) {
        startDate = parsedFrom;
      }
    }

    let endDate = defaultTo;
    if (to) {
      const parsedTo = new Date(to);
      if (!isNaN(parsedTo.getTime())) {
        endDate = parsedTo;
      }
    }
    endDate.setHours(23, 59, 59, 999);

    await connectToDatabase();

    const orderStatusMatch = {
      status: { $in: ['Paid', 'Confirmed', 'Ready for Delivery', 'Released for Delivery', 'Delivered'] },
      createdAt: { $gte: startDate, $lte: endDate },
      deletedAt: null
    };

    // Run ALL independent queries concurrently in parallel with Promise.all
    const [
      revenueStats,
      expenseStats,
      incomeStats,
      totalUsers,
      pendingOrdersCount,
      recentOrders,
      lowStockProducts,
      activeSubscribers,
      totalWalletBalanceResult,
      topSellingProducts,
      topCustomers,
      adExpenses,
      allUsersWithOrders,
      chartData,
      arResult,
      apResult
    ] = await Promise.all([
      // 1. Revenue, COGS, Delivery and Sales Count
      Order.aggregate([
        { $match: orderStatusMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalDeliveryCharge: { $sum: '$deliveryCharge' },
            salesCount: { $sum: 1 },
            totalCOGS: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: { $multiply: ['$$item.quantity', { $ifNull: ['$$item.purchasePrice', 0] }] }
                  }
                }
              }
            }
          }
        }
      ]),

      // 2. Expenses (excluding income)
      Expense.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
            type: { $ne: 'income' }
          }
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' }
          }
        }
      ]),

      // 3. Incomes
      Expense.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
            type: 'income'
          }
        },
        {
          $group: {
            _id: null,
            totalIncomes: { $sum: '$amount' }
          }
        }
      ]),

      // 4. Customers count
      User.countDocuments({ role: 'user' }),

      // 5. Pending Orders
      Order.countDocuments({ status: 'Order Placed', deletedAt: null }),

      // 6. Recent Orders
      Order.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('slug totalAmount status createdAt user')
        .populate('user', 'name email')
        .lean(),

      // 7. Low Stock Products
      Product.find({ stock: { $lt: 5 } })
        .limit(5)
        .select('name stock price')
        .lean(),

      // 8. Loyalty Subscribers
      User.countDocuments({ isSubscriptionActive: true }),

      // 9. Wallet tokens total
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$walletBalance' } } }
      ]),

      // 10. Top Selling Products
      Order.aggregate([
        { $match: orderStatusMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            quantity: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]),

      // 11. Top Customers
      Order.aggregate([
        { $match: orderStatusMatch },
        {
          $group: {
            _id: '$user',
            totalSpend: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalSpend: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userData'
          }
        },
        { $unwind: '$userData' },
        {
          $project: {
            name: '$userData.name',
            email: '$userData.email',
            totalSpend: 1,
            orderCount: 1
          }
        }
      ]),

      // 12. Ad Expenses
      Expense.aggregate([
        { $match: { category: 'Ads', date: { $gte: startDate, $lte: endDate }, type: { $ne: 'income' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),

      // 13. New vs Returning users
      Order.aggregate([
        {
          $match: {
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        { $group: { _id: '$user', count: { $sum: 1 } } }
      ]),

      // 14. Chart Data
      Order.aggregate([
        { $match: orderStatusMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
            cogs: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: { $multiply: ['$$item.quantity', { $ifNull: ['$$item.purchasePrice', 0] }] }
                  }
                }
              }
            },
            deliveryCharge: { $sum: '$deliveryCharge' }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            revenue: 1,
            orders: 1,
            profit: { $subtract: [{ $subtract: ['$revenue', '$cogs'] }, '$deliveryCharge'] }
          }
        },
        { $sort: { date: 1 } }
      ]),

      // 15. Real-Time Accounts Receivable (aggregate sum instead of loading all bills)
      Bill.aggregate([
        { $match: { $or: [{ documentType: 'bill' }, { documentType: { $exists: false } }] } },
        { $group: { _id: null, total: { $sum: '$currentBillDue' } } }
      ]),

      // 16. Real-Time Accounts Payable (aggregate sum instead of loading all supplier bills)
      SupplierBill.aggregate([
        { $group: { _id: null, total: { $sum: '$dueAmount' } } }
      ])
    ]);

    // Financial calculations
    const {
      totalRevenue = 0,
      totalDeliveryCharge = 0,
      salesCount = 0,
      totalCOGS = 0
    } = revenueStats[0] || {};

    const totalExpenses = expenseStats[0]?.totalExpenses || 0;
    const totalIncomes = incomeStats[0]?.totalIncomes || 0;
    const grossProfit = totalRevenue - totalCOGS - totalDeliveryCharge;
    const netProfit = grossProfit + totalIncomes - totalExpenses;

    const totalWalletTokens = totalWalletBalanceResult[0]?.total || 0;
    const totalAdSpend = adExpenses[0]?.total || 0;
    const roas = totalAdSpend > 0 ? Number((totalRevenue / totalAdSpend).toFixed(2)) : 0;

    const returningUsersCount = allUsersWithOrders.filter((u: any) => u.count > 1).length;
    const newUsersCount = allUsersWithOrders.filter((u: any) => u.count === 1).length;

    const accountsReceivable = arResult[0]?.total || 0;
    const accountsPayable = apResult[0]?.total || 0;

    return NextResponse.json(
      {
        stats: {
          totalRevenue,
          salesCount,
          totalUsers,
          pendingOrdersCount,
          activeSubscribers,
          totalWalletTokens,
          totalCOGS,
          totalExpenses,
          grossProfit,
          netProfit,
          roas,
          totalAdSpend,
          newUsersCount,
          returningUsersCount,
          accountsReceivable,
          accountsPayable
        },
        recentOrders,
        lowStockProducts,
        topSellingProducts,
        topCustomers,
        chartData
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
