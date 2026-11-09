'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import {
  Loader2,
  Search,
  DollarSign,
  Wallet,
  Landmark,
  Trash2,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  ArrowRightLeft,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/pagination';
import { generatePaymentReceiptPDF } from '@/lib/bill-invoice-generator';

function AccountsLedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalSearchTerm, setJournalSearchTerm] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [printingReceipt, setPrintingReceipt] = useState<string | null>(null);
  const [syncingLedger, setSyncingLedger] = useState(false);
  
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

  // Sync state to URL search params
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    router.push(`/admin/ledger?${params.toString()}`);
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    router.push(`/admin/ledger?${params.toString()}`);
  }, [journalSearchTerm, dateFilter.from, dateFilter.to]);

  useEffect(() => {
    fetchSettings();
    fetchAccounts();
    fetchTransactions();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handlePrintReceipt = async (invoiceNo: string, paymentAmount?: number, txDate?: string | Date, txId?: string, isInitialBill?: boolean) => {
    if (!invoiceNo || !invoiceNo.startsWith('INV-')) return;
    try {
      setPrintingReceipt(txId || invoiceNo);
      const res = await fetch(`/api/admin/bills?invoiceNo=${invoiceNo}`);
      if (!res.ok) throw new Error('Bill not found');
      const bill = await res.json();
      generatePaymentReceiptPDF(bill, settings, paymentAmount, txDate, txId, isInitialBill);
    } catch (err) {
      toast.error('Could not load bill details for receipt');
    } finally {
      setPrintingReceipt(null);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/admin/ledger/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      toast.error('Failed to load accounts');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/ledger/transactions');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data);
      // Refresh accounts to match clean recalculated balances
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to load transaction logs');
    } finally {
      setLoading(false);
    }
  };



  const handleSyncLedger = async () => {
    const result = await Swal.fire({
      title: 'Sync & Clean Ledger?',
      text: 'This will check all transactions against existing Bills and Expenses, automatically remove orphan entries from deleted records, and recalculate balances.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#00D1B2',
      confirmButtonText: 'Yes, Sync Now!'
    });

    if (!result.isConfirmed) return;

    try {
      setSyncingLedger(true);
      const res = await fetch('/api/admin/ledger/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Success!', data.message || 'Ledger synchronized successfully!', 'success');
        fetchAccounts();
        fetchTransactions();
      } else {
        toast.error(data.message || 'Failed to sync ledger');
      }
    } catch (err: any) {
      toast.error('Error synchronizing ledger');
    } finally {
      setSyncingLedger(false);
    }
  };

  const filteredTransactions = transactions
    .filter((tx) => {
      const term = journalSearchTerm.toLowerCase();
      const name = tx.account?.name?.toLowerCase() || '';
      const desc = tx.description?.toLowerCase() || '';
      const ref = tx.reference?.toLowerCase() || '';
      const id = String(tx._id || '').toLowerCase();
      const matchesSearch = name.includes(term) || desc.includes(term) || ref.includes(term) || id.includes(term);

      let matchesDate = true;
      if (dateFilter.from) {
        matchesDate = matchesDate && new Date(tx.date) >= new Date(dateFilter.from + 'T00:00:00');
      }
      if (dateFilter.to) {
        matchesDate = matchesDate && new Date(tx.date) <= new Date(dateFilter.to + 'T23:59:59');
      }

      return matchesSearch && matchesDate;
    })
    .sort((a, b) => {
      const timeB = new Date(b.date || b.createdAt).getTime();
      const timeA = new Date(a.date || a.createdAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      if (a.type === 'debit' && b.type === 'credit') return 1;
      if (a.type === 'credit' && b.type === 'debit') return -1;
      return String(b._id).localeCompare(String(a._id));
    });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 px-[2px] md:px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-heading">Accounts Ledger</h2>
          <p className="text-muted-foreground text-sm">
            Live double-entry financial ledger tracking cash, bank, receivables, and payables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            asChild
            className="w-full sm:w-auto font-semibold"
          >
            <Link href="/admin/expenses-incomes?action=new&tab=transfer">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Balance
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncLedger}
            disabled={syncingLedger}
            className="w-full sm:w-auto border-primary/40 text-primary hover:bg-primary/10 font-semibold"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncingLedger ? 'animate-spin' : ''}`} />
            {syncingLedger ? 'Syncing...' : 'Sync & Clean Ledger'}
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto bg-primary text-primary-foreground font-bold"
          >
            <Link href="/admin/expenses-incomes?action=new">
              <Plus className="mr-2 h-4 w-4" /> Add Record
            </Link>
          </Button>
        </div>
      </div>

      {/* Account Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {accounts.map((acc) => {
          const isCash = acc.code === 'CASH';
          const isBank = acc.code === 'BANK';

          return (
            <Card key={acc._id} className="relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-5 sm:pb-2">
                <CardTitle className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                  {acc.name}
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {isCash ? (
                    <Wallet className="h-4 w-4 text-primary" />
                  ) : isBank ? (
                    <Landmark className="h-4 w-4 text-primary" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
                <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                  ৳{Math.round(acc.currentBalance || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transactions Journal */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Transaction Journal</CardTitle>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search description or reference..."
                  className="pl-8"
                  value={journalSearchTerm}
                  onChange={(e) => setJournalSearchTerm(e.target.value)}
                />
              </div>
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
              {(dateFilter.from || dateFilter.to || journalSearchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFilter({ from: '', to: '' });
                    setJournalSearchTerm('');
                  }}
                  className="text-xs text-muted-foreground hover:text-primary w-full sm:w-auto"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No journal transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount (৳)</TableHead>
                    <TableHead className="text-right">Running Balance (৳)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx._id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {format(new Date(tx.date || tx.createdAt), 'dd MMM yyyy')}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(tx.date || tx.createdAt), 'hh:mm:ss a')}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{tx.account?.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 py-1">
                          <p className="font-medium text-foreground text-sm leading-snug">{tx.description}</p>
                          {tx.reference && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="text-[11px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase border border-primary/20">
                                REF: {tx.reference}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.type === 'debit' ? 'default' : 'outline'}
                          className={tx.type === 'debit' ? 'bg-primary/20 text-primary hover:bg-primary/20 border-transparent' : ''}
                        >
                          {tx.type === 'debit' ? 'Debit (+)' : 'Credit (-)'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">৳{Math.round(tx.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">৳{Math.round(tx.balanceAfter).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {tx.reference && tx.reference.startsWith('INV-') ? (
                          (() => {
                            const isInitialBill = (tx.account?.code === 'AR' && tx.type === 'debit') || (tx.description && tx.description.toLowerCase().includes('bill generated'));
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handlePrintReceipt(tx.reference, isInitialBill ? 0 : tx.amount, tx.date, tx._id, isInitialBill)}
                                  >
                                    {printingReceipt === tx._id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Receipt className="mr-2 h-4 w-4 text-emerald-600" />
                                    )}
                                    Print Receipt
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground pr-3">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

export default function AccountsLedgerPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <AccountsLedgerContent />
    </Suspense>
  );
}
