'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash, Edit, Search, MoreHorizontal, Loader2, Receipt, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionForm } from '@/components/admin/TransactionForm';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generatePaymentReceiptPDF } from '@/lib/bill-invoice-generator';

function ExpensesIncomesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [printingReceipt, setPrintingReceipt] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialType = (searchParams.get('type') as 'all' | 'expense' | 'income') || 'all';
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>(initialType);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Fetch store settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error('Failed to load settings:', err));
  }, []);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    if (typeFilter !== 'all') {
      params.set('type', typeFilter);
    } else {
      params.delete('type');
    }
    router.push(`/admin/expenses-incomes?${params.toString()}`);
  }, [currentPage, typeFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    router.push(`/admin/expenses-incomes?${params.toString()}`);
  }, [searchTerm, typeFilter, dateFilter.from, dateFilter.to]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/expenses-incomes');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsDialogOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      router.replace(`/admin/expenses-incomes?${params.toString()}`);
    }
  }, [searchParams, router]);

  const handlePrintReceipt = async (invoiceNo: string, amount: number, txDate: string, txId: string) => {
    try {
      setPrintingReceipt(txId);
      const res = await fetch(`/api/admin/bills?invoiceNo=${invoiceNo}`);
      if (!res.ok) throw new Error('Bill not found');
      const bill = await res.json();
      generatePaymentReceiptPDF(bill, settings, amount, txDate, txId);
    } catch (err) {
      toast.error('Could not load bill receipt');
    } finally {
      setPrintingReceipt(null);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete Transaction?',
      text: 'Are you sure you want to delete this transaction record? If it was a client bill collection, the bill balance will be automatically adjusted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/expenses-incomes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Transaction deleted');
        fetchTransactions();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to delete transaction');
      }
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase();
    const title = tx.title?.toLowerCase() || '';
    const cat = tx.category?.toLowerCase() || '';
    const inv = tx.invoiceNo?.toLowerCase() || '';
    const ref = tx.reference?.toLowerCase() || '';
    const matchesSearch = title.includes(term) || cat.includes(term) || inv.includes(term) || ref.includes(term);

    let matchesDate = true;
    if (dateFilter.from) {
      matchesDate = matchesDate && new Date(tx.date) >= new Date(dateFilter.from + 'T00:00:00');
    }
    if (dateFilter.to) {
      matchesDate = matchesDate && new Date(tx.date) <= new Date(dateFilter.to + 'T23:59:59');
    }

    let matchesType = true;
    if (typeFilter !== 'all') {
      matchesType = (tx.type || 'expense') === typeFilter;
    }

    return matchesSearch && matchesDate && matchesType;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const overviewTransactions = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase();
    const title = tx.title?.toLowerCase() || '';
    const cat = tx.category?.toLowerCase() || '';
    const matchesSearch = title.includes(term) || cat.includes(term);

    let matchesDate = true;
    if (dateFilter.from) {
      matchesDate = matchesDate && new Date(tx.date) >= new Date(dateFilter.from + 'T00:00:00');
    }
    if (dateFilter.to) {
      matchesDate = matchesDate && new Date(tx.date) <= new Date(dateFilter.to + 'T23:59:59');
    }

    return matchesSearch && matchesDate;
  });

  const totalIncome = overviewTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalExpense = overviewTransactions
    .filter((tx) => tx.type === 'expense' || !tx.type)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const isFiltered = !!(dateFilter.from || dateFilter.to || searchTerm);

  return (
    <div className="space-y-6 px-[2px] md:px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Expenses & Incomes</h1>
          <p className="text-muted-foreground text-sm">Track client bill receipts, sales, investments, ads, rent, salary, and overhead costs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/admin/expenses-incomes/categories">
              <Tags className="mr-2 h-4 w-4" /> Categories
            </Link>
          </Button>
          <Button
            onClick={() => {
              setEditingTransaction(null);
              setIsDialogOpen(true);
            }}
            className="bg-primary text-primary-foreground font-bold w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Record
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? 'Edit' : 'Add'} Transaction</DialogTitle>
          </DialogHeader>
          <TransactionForm
            initialData={editingTransaction}
            presetTab={(searchParams.get('tab') as any) || 'transaction'}
            onSuccess={(wasEdit) => {
              if (wasEdit) {
                setIsDialogOpen(false);
              }
              fetchTransactions();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">৳</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ৳ {totalIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isFiltered ? 'Selected range total cash inflow' : 'All-time total cash inflow'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expense</CardTitle>
            <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center font-bold text-xs text-destructive">৳</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ৳ {totalExpense.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isFiltered ? 'Selected range total cash outflow' : 'All-time total cash outflow'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
          <CardTitle>All Transactions</CardTitle>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, category, invoice..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border text-sm w-full sm:w-auto">
              <Input
                type="date"
                className="h-8 w-32 border-none bg-transparent focus-visible:ring-0"
                value={dateFilter.from}
                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                className="h-8 w-32 border-none bg-transparent focus-visible:ring-0"
                value={dateFilter.to}
                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>

            {(dateFilter.from || dateFilter.to || searchTerm || typeFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter({ from: '', to: '' });
                  setSearchTerm('');
                  setTypeFilter('all');
                }}
                className="text-xs text-muted-foreground hover:text-primary w-full sm:w-auto"
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title & Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount (Tk)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                      Loading transactions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isExpense = (tx.type || 'expense') === 'expense';
                  const hasBillInvoice = tx.invoiceNo || (tx.reference && tx.reference.startsWith('INV-'));
                  const invoiceNumber = tx.invoiceNo || tx.reference;

                  return (
                    <TableRow key={tx._id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(tx.date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {tx.title}
                          {invoiceNumber && (
                            <span className="text-[10px] uppercase font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                              {invoiceNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">
                            {tx.category || 'General'}
                          </span>
                          {tx.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                              • {tx.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isExpense ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
                            Expense
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                            Income
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isExpense ? '-' : '+'}৳{tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasBillInvoice && (
                              <DropdownMenuItem
                                onClick={() => handlePrintReceipt(invoiceNumber, tx.amount, tx.date, tx._id)}
                              >
                                {printingReceipt === tx._id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Receipt className="mr-2 h-4 w-4 text-emerald-600" />
                                )}
                                Print Receipt
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingTransaction(tx);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4 text-indigo-600" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(tx._id)}
                            >
                              <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="py-4 border-t bg-background px-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExpensesIncomesPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ExpensesIncomesContent />
    </Suspense>
  );
}
