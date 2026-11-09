'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Receipt, FileText, CheckCircle2, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Truck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generatePaymentReceiptPDF } from '@/lib/bill-invoice-generator';

const INCOME_CATEGORIES = [
  'Receive Client Bill',
  'Sales Income',
  'Service Revenue',
  'Investment / Capital',
  'Refund Received',
  'Others',
];

const EXPENSE_CATEGORIES = [
  'Supplier Bill Payment',
  'Office Rent',
  'Utility & Electricity',
  'Salary & Allowance',
  'Marketing & Ads',
  'Office Supplies & Stationery',
  'Entertainment & Refreshment',
  'Transport & Conveyance',
  'Equipment & Maintenance',
  'Software & Subscriptions',
  'Bank & Transaction Fees',
  'Others',
];

const transactionSchema = z.object({
  type: z.enum(['expense', 'income']),
  category: z.string().min(1, 'Category is required'),
  billId: z.string().optional(),
  invoiceNo: z.string().optional(),
  supplierBillId: z.string().optional(),
  supplierId: z.string().optional(),
  accountCode: z.string().min(1, 'Account is required').default('CASH'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  amount: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    z.number({ message: 'Amount is required' }).min(1, 'Amount must be at least 1')
  ),
  date: z.string().min(1, 'Date is required').refine(s => !isNaN(Date.parse(s)), { message: 'Invalid date format' }),
  description: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  initialData?: any;
  presetTab?: 'transaction' | 'transfer';
  onSuccess: (wasEdit: boolean) => void;
}

export function TransactionForm({ initialData, presetTab = 'transaction', onSuccess }: TransactionFormProps) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'transfer'>(presetTab);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  
  // Accounts with real-time balance
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Client Bills
  const [dueBills, setDueBills] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [loadingBills, setLoadingBills] = useState(false);

  // Supplier Bills & Suppliers
  const [dueSupplierBills, setDueSupplierBills] = useState<any[]>([]);
  const [selectedSupplierBill, setSelectedSupplierBill] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Categories
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Transfer State
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromAccountCode, setFromAccountCode] = useState<string>('CASH');
  const [toAccountCode, setToAccountCode] = useState<string>('BANK');
  const [transferTitle, setTransferTitle] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitLoading, setTransferSubmitLoading] = useState(false);

  // Refs for keyboard Enter navigation
  const dateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const billSelectRef = useRef<HTMLButtonElement>(null);
  const supplierBillSelectRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: initialData?.type || 'expense',
      category: initialData?.category || (initialData?.type === 'income' ? 'Receive Client Bill' : 'Office Supplies & Stationery'),
      billId: initialData?.bill?._id || initialData?.bill || '',
      invoiceNo: initialData?.invoiceNo || initialData?.reference || '',
      supplierBillId: initialData?.supplierBill?._id || initialData?.supplierBill || '',
      supplierId: initialData?.supplier?._id || initialData?.supplier || '',
      accountCode: initialData?.accountCode || 'CASH',
      title: initialData?.title || '',
      amount: initialData?.amount !== undefined ? initialData.amount : '',
      date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: initialData?.description || '',
    },
  });

  const selectedType = form.watch('type');
  const selectedCategory = form.watch('category');
  const selectedAmount = Number(form.watch('amount')) || 0;
  const selectedAccountCode = form.watch('accountCode');

  // Load Store Settings, Accounts, Categories, Client Bills, Supplier Bills
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error('Error fetching settings:', err));

    fetch('/api/admin/ledger/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAccounts(data.filter((a: any) => a.code === 'CASH' || a.code === 'BANK' || a.type === 'asset'));
        }
      })
      .catch((err) => console.error('Error fetching accounts:', err));

    fetch('/api/admin/transaction-categories')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDbCategories(data);
      })
      .catch((err) => console.error('Error fetching categories:', err));

    setLoadingBills(true);
    fetch('/api/admin/bills')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const dueList = data.filter(
            (b: any) => b.documentType === 'bill' && (b.status === 'Due' || (b.currentBillDue && b.currentBillDue > 0))
          );
          setDueBills(dueList);
        }
      })
      .catch((err) => console.error('Error fetching bills:', err))
      .finally(() => setLoadingBills(false));

    fetch('/api/admin/supplier-bills')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const dueList = data.filter((b: any) => b.status === 'Due' || b.status === 'Partially Paid' || (b.dueAmount && b.dueAmount > 0));
          setDueSupplierBills(dueList);
        }
      })
      .catch((err) => console.error('Error fetching supplier bills:', err));

    fetch('/api/admin/suppliers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSuppliers(data);
      })
      .catch((err) => console.error('Error fetching suppliers:', err));
  }, []);

  // When type changes, adjust default category
  const handleTypeChange = (newType: 'income' | 'expense') => {
    form.setValue('type', newType);
    if (newType === 'income') {
      form.setValue('category', 'Receive Client Bill');
      setSelectedSupplierBill(null);
      form.setValue('supplierBillId', '');
      form.setValue('supplierId', '');
    } else {
      form.setValue('category', 'Office Supplies & Stationery');
      setSelectedBill(null);
      form.setValue('billId', '');
      form.setValue('invoiceNo', '');
    }
  };

  // When a due client bill is selected
  const handleSelectBill = (billId: string | null) => {
    if (!billId) {
      setSelectedBill(null);
      form.setValue('billId', '');
      form.setValue('invoiceNo', '');
      return;
    }
    const bill = dueBills.find((b: any) => b._id === billId);
    if (bill) {
      setSelectedBill(bill);
      form.setValue('billId', bill._id);
      form.setValue('invoiceNo', bill.invoiceNo);
      form.setValue('title', `Bill Payment: ${bill.invoiceNo} - ${bill.clientName}`);
      form.setValue('amount', bill.currentBillDue || (bill.gTotal - (bill.cashIn || 0)));
      form.setValue('description', `Received payment from ${bill.clientName} for Bill #${bill.invoiceNo}`);
    } else {
      setSelectedBill(null);
      form.setValue('billId', '');
      form.setValue('invoiceNo', '');
    }
  };

  // When a supplier bill is selected
  const handleSelectSupplierBill = (billId: string | null) => {
    if (!billId) {
      setSelectedSupplierBill(null);
      form.setValue('supplierBillId', '');
      form.setValue('supplierId', '');
      return;
    }
    const supBill = dueSupplierBills.find((b: any) => b._id === billId);
    if (supBill) {
      setSelectedSupplierBill(supBill);
      form.setValue('supplierBillId', supBill._id);
      form.setValue('supplierId', supBill.supplier?._id || supBill.supplier);
      const supplierName = supBill.supplier?.name || supBill.supplier?.companyName || 'Supplier';
      form.setValue('title', `Supplier Payment: #${supBill.billNo} - ${supplierName}`);
      form.setValue('amount', supBill.dueAmount || supBill.total);
      form.setValue('description', `Payment to ${supplierName} for Supplier Bill #${supBill.billNo}`);
    } else {
      setSelectedSupplierBill(null);
      form.setValue('supplierBillId', '');
      form.setValue('supplierId', '');
    }
  };

  // Submit Transaction (Income / Expense)
  const onSubmit = async (values: TransactionFormValues) => {
    // Insufficient Balance Validation for Expense
    if (values.type === 'expense') {
      const selectedAcc = accounts.find(a => a.code === values.accountCode);
      if (selectedAcc) {
        const isEditCurrent = initialData && initialData.accountCode === values.accountCode && initialData.type === 'expense';
        const effectiveBalance = (selectedAcc.currentBalance || 0) + (isEditCurrent ? initialData.amount : 0);
        if (values.amount > effectiveBalance) {
          toast.error(`Insufficient balance in ${selectedAcc.name}. Available: ৳${effectiveBalance.toLocaleString()}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const url = initialData ? `/api/admin/expenses-incomes/${initialData._id}` : '/api/admin/expenses-incomes';
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        toast.success(`Transaction ${initialData ? 'updated' : 'recorded'} successfully`);

        if (initialData) {
          onSuccess(true);
        } else {
          form.reset({
            type: form.getValues('type'),
            category: form.getValues('type') === 'income' ? 'Receive Client Bill' : 'Office Supplies & Stationery',
            accountCode: form.getValues('accountCode') || 'CASH',
            billId: '',
            invoiceNo: '',
            supplierBillId: '',
            supplierId: '',
            title: '',
            amount: '' as any,
            date: form.getValues('date'),
            description: '',
          });
          setSelectedBill(null);
          setSelectedSupplierBill(null);
          onSuccess(false);
          setTimeout(() => {
            dateRef.current?.focus();
          }, 50);
        }
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to save transaction');
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Submit Account Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTitle.trim()) {
      toast.error('Transfer title or description is required');
      return;
    }
    const amtVal = parseFloat(transferAmount) || 0;
    if (amtVal <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }
    if (fromAccountCode === toAccountCode) {
      toast.error('Source and Destination accounts must be different');
      return;
    }
    const fromAcc = accounts.find(a => a.code === fromAccountCode);
    if (fromAcc && amtVal > (fromAcc.currentBalance || 0)) {
      toast.error(`Insufficient balance in ${fromAcc.name}. Available: ৳${(fromAcc.currentBalance || 0).toLocaleString()}`);
      return;
    }

    setTransferSubmitLoading(true);
    try {
      const payload = {
        entryType: 'transfer',
        amount: amtVal,
        description: transferTitle.trim(),
        date: transferDate,
        fromAccountCode,
        toAccountCode,
      };

      const res = await fetch('/api/admin/ledger/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Transfer failed');
      }

      toast.success('Account transfer recorded successfully!');
      setTransferTitle('');
      setTransferAmount('');
      onSuccess(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save transfer');
    } finally {
      setTransferSubmitLoading(false);
    }
  };

  // Keyboard navigation handlers
  const handleDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      categoryRef.current?.focus();
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      amountRef.current?.focus();
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      accountRef.current?.focus();
    }
  };

  const handleAccountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descriptionRef.current?.focus();
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtnRef.current?.click();
    }
  };

  const isClientBillIncome = selectedType === 'income' && selectedCategory === 'Receive Client Bill';
  const isSupplierBillExpense = selectedType === 'expense' && (selectedCategory === 'Supplier Bill Payment' || selectedCategory === 'Account payable');
  
  const customCats = dbCategories.filter((c: any) => c.type === selectedType).map((c: any) => c.name);
  const defaultCats = selectedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const categoryOptions = Array.from(new Set([...defaultCats, ...customCats]));

  return (
    <div className="space-y-4">
      {/* Top Modal Tabs: Cash In/Out vs Account Transfer */}
      {!initialData && (
        <div className="flex border-b border-muted">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'transaction'
                ? 'border-primary text-primary font-bold bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('transaction')}
          >
            <Receipt className="h-4 w-4" />
            <span>Income & Expense</span>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'transfer'
                ? 'border-primary text-primary font-bold bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('transfer')}
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>Account Transfer</span>
          </button>
        </div>
      )}

      {activeTab === 'transaction' ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5 pt-1">
            {/* Date & Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        {...field}
                        onKeyDown={handleDateKeyDown}
                        ref={(e) => {
                          field.ref(e);
                          dateRef.current = e;
                        }}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Deposit / Pay Account</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger ref={accountRef} onKeyDown={handleAccountKeyDown} className="h-9 text-xs">
                          <SelectValue placeholder="Select Account">
                            {field.value ? (() => {
                              const acc = accounts.find(a => a.code === field.value);
                              if (!acc) return field.value === 'BANK' ? 'Bank Account' : 'Cash Account';
                              const isEditCurrent = initialData && initialData.accountCode === acc.code && initialData.type === 'expense';
                              const effectiveBal = (acc.currentBalance || 0) + (isEditCurrent ? initialData.amount : 0);
                              return `${acc.name} (৳${effectiveBal.toLocaleString()})`;
                            })() : "Select Account"}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.length === 0 ? (
                          <>
                            <SelectItem value="CASH">Cash Account</SelectItem>
                            <SelectItem value="BANK">Bank Account</SelectItem>
                          </>
                        ) : (
                          accounts.map((acc) => {
                            const isEditCurrent = initialData && initialData.accountCode === acc.code && initialData.type === 'expense';
                            const effectiveBal = (acc.currentBalance || 0) + (isEditCurrent ? initialData.amount : 0);
                            const hasInsufficient = selectedType === 'expense' && selectedAmount > effectiveBal;
                            return (
                              <SelectItem
                                key={acc.code}
                                value={acc.code}
                                disabled={hasInsufficient}
                                className="text-xs"
                              >
                                {acc.name} (৳{effectiveBal.toLocaleString()}) {hasInsufficient && " - Insufficient Balance"}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Type Toggle */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-semibold">Transaction Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(val: any) => handleTypeChange(val)}
                      className="grid grid-cols-2 gap-3 pt-0.5"
                    >
                      <Label
                        htmlFor="type-income"
                        className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          field.value === 'income'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-500 font-bold'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="income" id="type-income" className="sr-only" />
                        <ArrowUpRight className="h-4 w-4" />
                        Income (+)
                      </Label>

                      <Label
                        htmlFor="type-expense"
                        className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          field.value === 'expense'
                            ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:border-rose-500 font-bold'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="expense" id="type-expense" className="sr-only" />
                        <ArrowDownRight className="h-4 w-4" />
                        Expense (-)
                      </Label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger ref={categoryRef} className="h-9 text-xs">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Client Due Bills Dropdown (When Receive Client Bill is selected) */}
            {isClientBillIncome && (
              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-emerald-600" /> Select Due Client Bill
                  </span>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full font-bold text-emerald-800 dark:text-emerald-300">
                    {dueBills.length} Due Bill(s)
                  </span>
                </div>

                <Select value={form.watch('billId')} onValueChange={handleSelectBill}>
                  <SelectTrigger ref={billSelectRef} className="w-full bg-background text-sm h-11 px-3 border border-input shadow-xs">
                    <SelectValue placeholder={loadingBills ? "Loading due bills..." : "Choose client bill to collect payment"}>
                      {selectedBill ? (
                        <span className="font-semibold text-foreground text-sm truncate">
                          <strong className="text-base text-foreground font-bold">{selectedBill.clientName}</strong> — #{selectedBill.invoiceNo} (Due: ৳{(selectedBill.currentBillDue || (selectedBill.gTotal - (selectedBill.cashIn || 0))).toLocaleString()})
                        </span>
                      ) : (
                        "Choose client bill"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[340px] sm:min-w-[440px] max-h-64 p-1">
                    {dueBills.length === 0 ? (
                      <SelectItem value="none" disabled className="text-sm py-2 text-center">No pending due bills found</SelectItem>
                    ) : (
                      dueBills.map((b) => {
                        const remaining = b.currentBillDue !== undefined ? b.currentBillDue : (b.gTotal - (b.cashIn || 0));
                        return (
                          <SelectItem key={b._id} value={b._id} className="text-sm py-2 px-3 border-b border-border/40 last:border-0 cursor-pointer">
                            <div className="flex flex-col gap-1 w-full text-left">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-sm sm:text-base text-foreground">
                                  {b.clientName}
                                </span>
                                <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded shrink-0">
                                  {b.invoiceNo}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>Total: ৳{(b.gTotal || b.total).toLocaleString()}</span>
                                <span>•</span>
                                <span>Paid: ৳{(b.cashIn || 0).toLocaleString()}</span>
                                <span>•</span>
                                <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                                  Due: ৳{remaining.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>

                {selectedBill && (
                  <div className="p-2.5 bg-background/80 border border-emerald-200 dark:border-emerald-900/50 rounded-md flex items-center justify-between gap-2 shadow-2xs">
                    <div>
                      <div className="text-sm font-bold text-foreground">{selectedBill.clientName}</div>
                      <div className="text-xs text-muted-foreground font-mono">Invoice #{selectedBill.invoiceNo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Remaining Due</div>
                      <div className="text-sm font-bold text-rose-600">
                        ৳{(selectedBill.currentBillDue || (selectedBill.gTotal - (selectedBill.cashIn || 0))).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supplier Due Bills Dropdown (When Supplier Bill Payment is selected) */}
            {isSupplierBillExpense && (
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-amber-600" /> Select Due Supplier Bill
                  </span>
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 rounded-full font-bold text-amber-800 dark:text-amber-300">
                    {dueSupplierBills.length} Due Bill(s)
                  </span>
                </div>

                <Select value={form.watch('supplierBillId')} onValueChange={handleSelectSupplierBill}>
                  <SelectTrigger ref={supplierBillSelectRef} className="w-full bg-background text-sm h-11 px-3 border border-input shadow-xs">
                    <SelectValue placeholder="Choose supplier bill to pay">
                      {selectedSupplierBill ? (
                        <span className="font-semibold text-foreground text-sm truncate">
                          <strong className="text-base text-foreground font-bold">{selectedSupplierBill.supplier?.name || selectedSupplierBill.supplier?.companyName || 'Supplier'}</strong> — #{selectedSupplierBill.billNo} (Due: ৳{(selectedSupplierBill.dueAmount || selectedSupplierBill.total).toLocaleString()})
                        </span>
                      ) : (
                        "Choose supplier bill"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[340px] sm:min-w-[440px] max-h-64 p-1">
                    {dueSupplierBills.length === 0 ? (
                      <SelectItem value="none" disabled className="text-sm py-2 text-center">No pending supplier bills found</SelectItem>
                    ) : (
                      dueSupplierBills.map((b) => (
                        <SelectItem key={b._id} value={b._id} className="text-sm py-2 px-3 border-b border-border/40 last:border-0 cursor-pointer">
                          <div className="flex flex-col gap-1 w-full text-left">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-sm sm:text-base text-foreground">
                                {b.supplier?.name || b.supplier?.companyName || 'Supplier'}
                              </span>
                              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded shrink-0">
                                #{b.billNo}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>Total: ৳{b.total.toLocaleString()}</span>
                              <span>•</span>
                              <span>Paid: ৳{(b.paidAmount || 0).toLocaleString()}</span>
                              <span>•</span>
                              <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                                Due: ৳{b.dueAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {selectedSupplierBill && (
                  <div className="p-2.5 bg-background/80 border border-amber-200 dark:border-amber-900/50 rounded-md flex items-center justify-between gap-2 shadow-2xs">
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {selectedSupplierBill.supplier?.name || selectedSupplierBill.supplier?.companyName || 'Supplier'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">Bill #{selectedSupplierBill.billNo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Remaining Due</div>
                      <div className="text-sm font-bold text-rose-600">
                        ৳{(selectedSupplierBill.dueAmount || selectedSupplierBill.total).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Title / Particulars</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={selectedType === 'income' ? 'e.g. Bill Payment INV-0012' : 'e.g. Office Rent or Supplier Payment'}
                      className="h-9 text-xs"
                      {...field}
                      onKeyDown={handleTitleKeyDown}
                      ref={(e) => {
                        field.ref(e);
                        titleRef.current = e;
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Amount (৳)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="h-9 text-xs font-bold"
                      {...field}
                      onKeyDown={handleAmountKeyDown}
                      onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                      ref={(e) => {
                        field.ref(e);
                        amountRef.current = e;
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Remarks / Note (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes regarding this transaction..."
                      className="min-h-[50px] text-xs py-1.5"
                      {...field}
                      onKeyDown={handleDescriptionKeyDown}
                      ref={(e) => {
                        field.ref(e);
                        descriptionRef.current = e;
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <Button
              ref={submitBtnRef}
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold h-9 text-xs mt-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Record' : `Record ${selectedType === 'income' ? 'Income' : 'Expense'}`}
            </Button>
          </form>
        </Form>
      ) : (
        /* Account Transfer Form */
        <form onSubmit={handleTransferSubmit} className="space-y-3.5 pt-1">
          <div className="space-y-1">
            <Label htmlFor="transferDate" className="text-xs font-semibold">Transfer Date</Label>
            <Input
              id="transferDate"
              type="date"
              className="h-9 text-xs"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fromAcc" className="text-xs font-semibold">From Account (Source)</Label>
              <Select
                value={fromAccountCode}
                onValueChange={(val: any) => {
                  setFromAccountCode(val);
                  if (val === toAccountCode) {
                    const next = accounts.find(a => a.code !== val);
                    if (next) setToAccountCode(next.code);
                  }
                }}
              >
                <SelectTrigger id="fromAcc" className="h-9 text-xs">
                  <SelectValue>
                    {fromAccountCode ? (() => {
                      const acc = accounts.find(a => a.code === fromAccountCode);
                      return acc ? `${acc.name} (৳${(acc.currentBalance || 0).toLocaleString()})` : fromAccountCode;
                    })() : "Select Source"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => {
                    const amt = parseFloat(transferAmount) || 0;
                    const insufficient = amt > (acc.currentBalance || 0);
                    return (
                      <SelectItem key={acc.code} value={acc.code} disabled={insufficient} className="text-xs">
                        {acc.name} (৳{(acc.currentBalance || 0).toLocaleString()}) {insufficient && " - Insufficient"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="toAcc" className="text-xs font-semibold">To Account (Destination)</Label>
              <Select
                value={toAccountCode}
                onValueChange={(val: any) => {
                  setToAccountCode(val);
                  if (val === fromAccountCode) {
                    const next = accounts.find(a => a.code !== val);
                    if (next) setFromAccountCode(next.code);
                  }
                }}
              >
                <SelectTrigger id="toAcc" className="h-9 text-xs">
                  <SelectValue>
                    {toAccountCode ? (() => {
                      const acc = accounts.find(a => a.code === toAccountCode);
                      return acc ? `${acc.name} (৳${(acc.currentBalance || 0).toLocaleString()})` : toAccountCode;
                    })() : "Select Destination"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.code} value={acc.code} className="text-xs">
                      {acc.name} (৳{(acc.currentBalance || 0).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="transferTitle" className="text-xs font-semibold">Transfer Note / Description</Label>
            <Input
              id="transferTitle"
              placeholder="e.g. Bank deposit from Cash drawer"
              className="h-9 text-xs"
              value={transferTitle}
              onChange={(e) => setTransferTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="transferAmt" className="text-xs font-semibold">Transfer Amount (৳)</Label>
            <Input
              id="transferAmt"
              type="number"
              min="1"
              step="any"
              placeholder="0.00"
              className="h-9 text-xs font-bold"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={transferSubmitLoading}
            className="w-full bg-primary text-primary-foreground font-bold h-9 text-xs mt-1"
          >
            {transferSubmitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Execute Account Transfer
          </Button>
        </form>
      )}
    </div>
  );
}
