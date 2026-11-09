/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Plus,
  Trash2,
  Printer,
  Download,
  DollarSign,
  Users,
  Search,
  CreditCard,
  FileText,
  Package,
  Eye,
  MapPin,
  Phone,
  User,
  Mail,
  CalendarDays,
  Hash,
  MoreHorizontal,
  Edit,
  History,
  Clock,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { generateBillPDF, generateDescriptionHtml, generatePaymentReceiptPDF } from '@/lib/bill-invoice-generator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';

interface BillItemInput {
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

const extractTextFromDescription = (description?: string): string => {
  if (!description) return '';
  const trimmed = description.trim();
  // Try to parse as TipTap JSON directly
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const getText = (node: any, isBlock?: boolean): string => {
        if (node.text) return node.text;
        if (node.content && Array.isArray(node.content)) {
          const inner = node.content.map((n: any) => getText(n)).join('');
          if (node.type === 'paragraph' || node.type === 'heading') return inner + '\n';
          return inner;
        }
        return '';
      };
      return getText(parsed).trim();
    } catch (e) {
      // Not valid JSON, fall through
    }
  }
  // Strip any HTML tags and return
  return trimmed.replace(/<[^>]*>?/gm, '').trim();
};

function ClientBillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [bills, setBills] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const initialStatus = searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const [currentPage, setCurrentPage] = useState(initialPage);

  const [settings, setSettings] = useState<any>(null);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (currentPage > 1) {
        params.set('page', currentPage.toString());
      } else {
        params.delete('page');
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      } else {
        params.delete('status');
      }
      router.push(`/admin/bills?${params.toString()}`);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentPage, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      router.push(`/admin/bills?${params.toString()}`);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, dateFilter.from, dateFilter.to]);

  // Bill detail view state
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [editingBill, setEditingBill] = useState<any>(null);

  // Payment history modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [selectedHistoryBill, setSelectedHistoryBill] = useState<any>(null);

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [billItems, setBillItems] = useState<BillItemInput[]>([
    { name: '', description: '', quantity: 1, price: 0 }
  ]);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [prevDue, setPrevDue] = useState<number>(0);
  const [cashIn, setCashIn] = useState<number>(0);
  const [expectedReceivableDate, setExpectedReceivableDate] = useState('');
  const [vatTaxIncluded, setVatTaxIncluded] = useState<boolean>(true);

  // Auto suggestion states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeSuggestions, setActiveSuggestions] = useState<any[]>([]);
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<'name' | 'email' | 'phone' | null>(null);

  // Product multi-select state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  // Map of productId → variantId (null = base product, string = variant _id)
  const [selectedProductVariants, setSelectedProductVariants] = useState<Record<string, string | null>>({});
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // Phone validation
  const [phoneError, setPhoneError] = useState('');

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/admin/suggest-clients');
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setSuggestions(result.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching client suggestions:', err);
    }
  };

  const handleNameChange = (val: string) => {
    setClientName(val);
    if (!val.trim()) {
      setActiveSuggestions([]);
      setShowSuggestionsFor(null);
      return;
    }
    const filtered = suggestions.filter(s =>
      s.name?.toLowerCase().includes(val.toLowerCase())
    );
    setActiveSuggestions(filtered);
    setShowSuggestionsFor('name');
  };

  const handleEmailChange = (val: string) => {
    setClientEmail(val);
    if (!val.trim()) {
      setActiveSuggestions([]);
      setShowSuggestionsFor(null);
      return;
    }
    const filtered = suggestions.filter(s =>
      s.email?.toLowerCase().includes(val.toLowerCase())
    );
    setActiveSuggestions(filtered);
    setShowSuggestionsFor('email');
  };

  const handlePhoneChange = (val: string) => {
    setClientPhone(val);
    if (phoneError) validatePhone(val);
    if (!val.trim()) {
      setActiveSuggestions([]);
      setShowSuggestionsFor(null);
      return;
    }
    const filtered = suggestions.filter(s =>
      s.phone?.includes(val)
    );
    setActiveSuggestions(filtered);
    setShowSuggestionsFor('phone');
  };

  const handleSelectSuggestion = (suggestion: any) => {
    setClientName(suggestion.name || '');
    setClientPhone(suggestion.phone || '');
    setClientEmail(suggestion.email || '');
    setClientAddress(suggestion.address || '');
    if (phoneError) setPhoneError('');
    setActiveSuggestions([]);
    setShowSuggestionsFor(null);
  };

  const fetchBills = async () => {
    try {
      // Defer state update to microtask queue to avoid synchronous setState inside useEffect warning
      await Promise.resolve();
      setLoading(true);
      const res = await fetch(`/api/admin/bills?filter=${statusFilter}&type=bill`);
      if (!res.ok) throw new Error('Failed to fetch bills');
      const data = await res.json();
      setBills(data);
    } catch (error) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
      fetchProducts();
      fetchSettings();
      fetchSuggestions();
    }, 0);
    return () => clearTimeout(timer);
  }, [statusFilter]);

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = discountType === 'percentage'
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;
  const total = Math.max(0, subtotal + deliveryCharge + serviceFee - discount);
  const gTotal = total + prevDue;
  const currentBillDue = Math.max(0, gTotal - cashIn);
  const calculatedStatus = currentBillDue <= 0 ? 'Paid' : 'Due';

  const validatePhone = (phone: string) => {
    const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    if (!phone.trim()) {
      setPhoneError('Phone number is required');
      return false;
    }
    if (!bdPhoneRegex.test(phone.replace(/\s/g, ''))) {
      setPhoneError('Enter a valid BD number (e.g. 017XXXXXXXX)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const toggleProductVariant = (productId: string, variantId: string | null) => {
    setSelectedProductVariants(prev => {
      const current = prev[productId];
      // Clicking the same selection again → deselect
      if (current === variantId) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: variantId };
    });
  };

  const selectedCount = Object.keys(selectedProductVariants).length;

  const handleAddSelectedProducts = () => {
    const newItems: BillItemInput[] = [];

    Object.entries(selectedProductVariants).forEach(([productId, variantId]) => {
      const prod = products.find(p => p._id === productId);
      if (!prod) return;

      if (variantId === null) {
        // Base product (no variant chosen)
        newItems.push({ name: prod.name, description: extractTextFromDescription(prod.description), price: prod.salePrice || prod.price || 0, quantity: 1 });
      } else {
        // Specific variant
        const variant = (prod.variants || []).find((v: any) => v._id === variantId);
        if (!variant) return;
        const label = [prod.name, variant.color, variant.size].filter(Boolean).join(' — ');
        newItems.push({ name: label, description: extractTextFromDescription(prod.description), price: variant.salePrice || variant.price || 0, quantity: 1 });
      }
    });

    if (newItems.length === 0) return;

    if (billItems.length === 1 && billItems[0].name === '' && billItems[0].price === 0) {
      setBillItems(newItems);
    } else {
      setBillItems(prev => [...prev, ...newItems]);
    }
    setSelectedProductVariants({});
    setProductPickerOpen(false);
    setProductSearchTerm('');
  };

  const handleAddItemRow = () => {
    setBillItems([...billItems, { name: '', description: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (billItems.length === 1) {
      setBillItems([{ name: '', description: '', quantity: 1, price: 0 }]);
    } else {
      setBillItems(billItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof BillItemInput, value: any) => {
    const updated = [...billItems];
    if (field === 'quantity') {
      updated[index].quantity = Math.max(1, parseInt(value) || 1);
    } else if (field === 'price') {
      updated[index].price = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'description') {
      updated[index].description = value;
    } else {
      updated[index].name = value;
    }
    setBillItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientAddress.trim()) {
      toast.error('Client details are required');
      return;
    }
    if (!validatePhone(clientPhone)) {
      toast.error('Please enter a valid Bangladesh phone number');
      return;
    }

    const validItems = billItems.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      toast.error('At least one item with a name is required');
      return;
    }

    if (calculatedStatus === 'Due' && !expectedReceivableDate) {
      toast.error('Expected receivable date is required for due bills');
      return;
    }

    try {
      setFormLoading(true);
      const billData = {
        clientName,
        clientPhone,
        clientEmail: clientEmail.trim() || undefined,
        clientAddress,
        items: validItems,
        subtotal,
        deliveryCharge,
        serviceFee,
        discountType,
        discountValue,
        discount,
        total,
        prevDue,
        gTotal,
        cashIn,
        currentBillDue,
        status: calculatedStatus,
        expectedReceivableDate: calculatedStatus === 'Due' ? expectedReceivableDate : undefined,
        vatTaxIncluded,
        documentType: 'bill'
      };

      const url = editingBill ? `/api/admin/bills/${editingBill._id}` : '/api/admin/bills';
      const method = editingBill ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${editingBill ? 'update' : 'create'} bill`);
      }

      const createdBill = await res.json();
      toast.success(editingBill ? 'Bill updated successfully!' : 'Bill generated successfully!');

      setIsCreateOpen(false);
      resetForm();
      fetchBills();
      fetchSuggestions();
    } catch (error: any) {
      toast.error(error.message || 'Error saving bill');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setPhoneError('');
    setClientAddress('');
    setBillItems([{ name: '', description: '', quantity: 1, price: 0 }]);
    setDeliveryCharge(0);
    setServiceFee(0);
    setDiscountType('fixed');
    setDiscountValue(0);
    setPrevDue(0);
    setCashIn(0);
    setExpectedReceivableDate('');
    setVatTaxIncluded(true);
    setSelectedProductVariants({});
    setProductSearchTerm('');
    setProductPickerOpen(false);
    setEditingBill(null);
    setActiveSuggestions([]);
    setShowSuggestionsFor(null);
  };

  const handleUpdateStatus = async (billId: string, currentDue: number) => {
    const { value: paidAmount } = await Swal.fire({
      title: 'Update Payment Cash-in',
      input: 'number',
      inputLabel: 'Amount Paid (৳)',
      inputValue: currentDue,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || isNaN(Number(value)) || Number(value) < 0) {
          return 'Please enter a valid positive amount';
        }
      }
    });

    if (paidAmount !== undefined) {
      try {
        const amount = Number(paidAmount);
        const bill = bills.find(b => b._id === billId);
        if (!bill) return;

        const newCashIn = (bill.cashIn || 0) + amount;
        const newDue = Math.max(0, bill.gTotal - newCashIn);
        const newStatus = newDue <= 0 ? 'Paid' : 'Due';

        const res = await fetch(`/api/admin/bills/${billId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cashIn: newCashIn,
            currentBillDue: newDue,
            status: newStatus
          })
        });

        if (!res.ok) throw new Error('Failed to update bill');
        toast.success('Payment updated successfully');
        fetchBills();
        if (selectedHistoryBill && selectedHistoryBill._id === billId) {
          handleOpenTransactionHistory({ ...bill, cashIn: newCashIn, currentBillDue: newDue, status: newStatus });
        }
      } catch (error) {
        toast.error('Failed to update payment');
      }
    }
  };

  const handleOpenTransactionHistory = async (bill: any) => {
    setSelectedHistoryBill(bill);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/bills/${bill._id}/transactions`);
      if (!res.ok) throw new Error('Failed to load transaction history');
      const data = await res.json();
      setHistoryData(data);
      if (data.bill) {
        setSelectedHistoryBill(data.bill);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading transaction history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/bills/${billId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete bill');
        toast.success('Bill deleted successfully');
        fetchBills();
      } catch (error) {
        toast.error('Failed to delete bill');
      }
    }
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch = b.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.clientPhone.includes(searchTerm) ||
      b.invoiceNo.includes(searchTerm);

    let matchesDate = true;
    if (dateFilter.from) {
      matchesDate = matchesDate && new Date(b.date) >= new Date(dateFilter.from + 'T00:00:00');
    }
    if (dateFilter.to) {
      matchesDate = matchesDate && new Date(b.date) <= new Date(dateFilter.to + 'T23:59:59');
    }

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = b.status?.toLowerCase() === statusFilter.toLowerCase();
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredBills.length / ITEMS_PER_PAGE);
  const paginatedBills = filteredBills.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Metrics
  const totalBilled = bills.reduce((sum, b) => sum + (b.gTotal || 0), 0);
  const totalCollected = bills.reduce((sum, b) => sum + (b.cashIn || 0), 0);
  const accountsReceivable = bills.reduce((sum, b) => sum + (b.currentBillDue || 0), 0);

  return (
    <div className="flex-1 space-y-6 px-[2px] md:px-4 py-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Client Billing Manager</h2>
          <p className="text-muted-foreground text-sm">Create bills, offer discounts, manage collections & track receivables.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="w-full md:w-auto font-bold bg-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Create Bill
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{totalBilled.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Cumulative client invoicing</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected (Cash-in)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">৳{totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Payments received</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">৳{accountsReceivable.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Outstanding due balances</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone or bill no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex gap-2">
            {['all', 'paid', 'due'].map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? 'default' : 'outline'}
                onClick={() => setStatusFilter(filter)}
                className="capitalize font-bold"
              >
                {filter}
              </Button>
            ))}
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

          {(dateFilter.from || dateFilter.to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateFilter({ from: '', to: '' })}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Clear Date
            </Button>
          )}
        </div>
      </div>

      {/* Bill List Table */}
      <div className="rounded-md border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Bill No</TableHead>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead className="w-[200px] max-w-[220px]">Client Details</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-right">Paid (Cash-in)</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Expected Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredBills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No bills found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedBills.map((bill) => (
                <TableRow key={bill._id}>
                  <TableCell className="whitespace-nowrap">
                    <button
                      onClick={() => setSelectedBill(bill)}
                      className="font-bold text-primary hover:underline underline-offset-2 flex items-center gap-1 group transition-colors"
                      title="View Bill Details"
                    >
                      <Hash className="h-3 w-3" />
                      {bill.invoiceNo}
                      <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(bill.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal break-words">
                    <div className="font-medium leading-snug">{bill.clientName}</div>
                    <div className="text-xs text-muted-foreground">{bill.clientPhone}</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">৳{bill.gTotal}</TableCell>
                  <TableCell className="text-right text-green-600">৳{bill.cashIn}</TableCell>
                  <TableCell className="text-right text-orange-600 font-semibold">৳{bill.currentBillDue}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={bill.status === 'Paid' ? 'default' : 'destructive'} className={bill.status === 'Paid' ? 'bg-green-600 text-white border-none' : ''}>
                      {bill.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {bill.expectedReceivableDate ? format(new Date(bill.expectedReceivableDate), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        onClick={() => generateBillPDF(bill, settings, 'print')}
                        title="Print Bill"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {bill.status === 'Due' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleUpdateStatus(bill._id, bill.currentBillDue)}
                          title="Collect Cash"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedBill(bill)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenTransactionHistory(bill)}>
                            <History className="mr-2 h-4 w-4 text-purple-600" /> Payment History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingBill(bill);
                              setClientName(bill.clientName);
                              setClientPhone(bill.clientPhone);
                              setClientEmail(bill.clientEmail || '');
                              setClientAddress(bill.clientAddress);
                              setBillItems(bill.items);
                              setDeliveryCharge(bill.deliveryCharge);
                              setServiceFee(bill.serviceFee || 0);
                              setDiscountType(bill.discountType || 'fixed');
                              setDiscountValue(bill.discountValue || 0);
                              setPrevDue(bill.prevDue || 0);
                              setCashIn(bill.cashIn || 0);
                              setExpectedReceivableDate(bill.expectedReceivableDate ? format(new Date(bill.expectedReceivableDate), 'yyyy-MM-dd') : '');
                              setVatTaxIncluded(bill.vatTaxIncluded !== undefined ? bill.vatTaxIncluded : true);
                              setIsCreateOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" /> Edit Bill
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateBillPDF(bill, settings, 'download')}>
                            <Download className="mr-2 h-4 w-4 text-blue-600" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateBillPDF(bill, settings, 'print')}>
                            <Printer className="mr-2 h-4 w-4 text-teal-600" /> Print Bill
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generatePaymentReceiptPDF(bill, settings)}>
                            <CreditCard className="mr-2 h-4 w-4 text-emerald-600" /> Print Receipt
                          </DropdownMenuItem>
                          {bill.status === 'Due' && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(bill._id, bill.currentBillDue)}>
                              <CreditCard className="mr-2 h-4 w-4 text-green-600" /> Collect Cash
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteBill(bill._id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
      </div>

      {/* Create Bill Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBill ? 'Edit' : 'Generate'} Client Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Info with Auto Suggestion (2 rows x 2 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border">
              {/* Client Name */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="clientName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Client Name *
                </Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestionsFor(null), 250)}
                  placeholder="e.g. Rahim Khan"
                  className="h-10 text-sm bg-background"
                  required
                  autoComplete="off"
                />
                {showSuggestionsFor === 'name' && activeSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-xl max-h-56 overflow-y-auto divide-y">
                    {activeSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(s)}
                        className="p-2.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                      >
                        <div className="font-bold">{s.name}</div>
                        <div className="text-muted-foreground">
                          {s.phone ? `Phone: ${s.phone}` : ''} {s.email ? `| Email: ${s.email}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Phone */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="clientPhone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Client Phone *
                </Label>
                <Input
                  id="clientPhone"
                  value={clientPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={(e) => {
                    validatePhone(e.target.value);
                    setTimeout(() => setShowSuggestionsFor(null), 250);
                  }}
                  placeholder="e.g. 01712345678"
                  className={`h-10 text-sm bg-background ${phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  required
                  autoComplete="off"
                />
                {phoneError && <p className="text-[11px] text-destructive mt-0.5">{phoneError}</p>}
                {showSuggestionsFor === 'phone' && activeSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-xl max-h-56 overflow-y-auto divide-y">
                    {activeSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(s)}
                        className="p-2.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                      >
                        <div className="font-bold">{s.phone}</div>
                        <div className="text-muted-foreground">
                          {s.name} {s.email ? `| ${s.email}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Email (Optional) */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="clientEmail" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email (Optional)
                </Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestionsFor(null), 250)}
                  placeholder="e.g. client@example.com"
                  className="h-10 text-sm bg-background"
                  autoComplete="off"
                />
                {showSuggestionsFor === 'email' && activeSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-xl max-h-56 overflow-y-auto divide-y">
                    {activeSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(s)}
                        className="p-2.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                      >
                        <div className="font-bold">{s.email}</div>
                        <div className="text-muted-foreground">
                          {s.name} {s.phone ? `| ${s.phone}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Address */}
              <div className="space-y-1.5">
                <Label htmlFor="clientAddress" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Client Address *
                </Label>
                <Input
                  id="clientAddress"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="e.g. Nawabpur, Dhaka"
                  className="h-10 text-sm bg-background"
                  required
                />
              </div>
            </div>

            {/* Bill Items header with Product Selection Button */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Bill Items</h4>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setProductPickerOpen(true)}
                    className="font-bold"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Select Products
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow} className="font-bold">
                    <Plus className="h-3 w-3 mr-1" /> Add Custom Item
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {billItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Title"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        required
                      />
                      <Input
                        placeholder="Description (Optional)"
                        value={item.description || ''}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="text-xs h-8 text-muted-foreground"
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-20"
                      min="1"
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Rate"
                      value={item.price || ''}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      className="w-28"
                      min="0"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItemRow(index)}
                      className="text-destructive hover:bg-destructive/10 shrink-0 h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Adjustments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryCharge">Delivery Charge (৳)</Label>
                    <Input
                      id="deliveryCharge"
                      type="number"
                      value={deliveryCharge || ''}
                      onChange={(e) => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceFee">Service Fee (৳) <span className="text-muted-foreground font-normal text-xs">— Optional</span></Label>
                    <Input
                      id="serviceFee"
                      type="number"
                      value={serviceFee || ''}
                      placeholder="0"
                      onChange={(e) => setServiceFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prevDue">Previous Due (৳)</Label>
                  <Input
                    id="prevDue"
                    type="number"
                    value={prevDue || ''}
                    onChange={(e) => setPrevDue(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="space-y-2 col-span-1">
                    <Label>Discount Type</Label>
                    <Select value={discountType} onValueChange={(val: any) => { setDiscountType(val); setDiscountValue(0); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed (৳)</SelectItem>
                        <SelectItem value="percentage">Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Discount Value</Label>
                    <Input
                      type="number"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder={discountType === 'percentage' ? '%' : '৳'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cashIn">Cash-in (Paid) (৳)</Label>
                    <Input
                      id="cashIn"
                      type="number"
                      value={cashIn || ''}
                      onChange={(e) => setCashIn(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="pt-2">
                      <Badge variant={calculatedStatus === 'Paid' ? 'default' : 'destructive'} className={calculatedStatus === 'Paid' ? 'bg-green-600 text-white border-none' : ''}>
                        {calculatedStatus}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {calculatedStatus === 'Due' ? (
                    <div className="space-y-2">
                      <Label htmlFor="expectedReceivableDate">Expected Date of Receivable *</Label>
                      <Input
                        id="expectedReceivableDate"
                        type="date"
                        value={expectedReceivableDate}
                        onChange={(e) => setExpectedReceivableDate(e.target.value)}
                        required
                      />
                    </div>
                  ) : <div />}
                  <div className={`flex items-center space-x-2 ${calculatedStatus === 'Due' ? 'pt-6' : 'pt-2'}`}>
                    <Checkbox
                      id="vatTaxIncluded"
                      checked={vatTaxIncluded}
                      onCheckedChange={(checked) => setVatTaxIncluded(checked === true)}
                    />
                    <Label htmlFor="vatTaxIncluded" className="text-sm font-medium leading-none cursor-pointer">
                      VAT & Tax Included
                    </Label>
                  </div>
                </div>
              </div>

              {/* Summary calculations view */}
              <div className="bg-muted/40 p-4 rounded-lg space-y-3 border h-fit text-sm">
                <h4 className="font-bold border-b pb-2 mb-2 text-base">Bill Summary</h4>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">৳{subtotal.toLocaleString()}</span>
                </div>
                {deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>+ ৳{deliveryCharge.toLocaleString()}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between">
                    <span>Service Fee:</span>
                    <span>+ ৳{serviceFee.toLocaleString()}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount {discountType === 'percentage' && `(${discountValue}%)`}:</span>
                    <span>- ৳{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Total Bill:</span>
                  <span>৳{total.toLocaleString()}</span>
                </div>
                {prevDue > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Previous Due:</span>
                    <span>+ ৳{prevDue.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-bold text-lg text-primary">
                  <span>Grand Total:</span>
                  <span>৳{gTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-700 border-t pt-2">
                  <span>Cash-in:</span>
                  <span>৳{cashIn.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold text-base text-destructive">
                  <span>Remaining Due:</span>
                  <span>৳{currentBillDue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={formLoading} className="font-bold">
                {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingBill ? 'Update Bill' : 'Generate Bill')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Selection Dialog */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-8"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
              />
            </div>
            <div className="border rounded-md overflow-hidden max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Options / Variants</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products
                    .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                    .map((prod) => {
                      const hasVariants = prod.variants && prod.variants.length > 0;
                      return (
                        <TableRow key={prod._id}>
                          <TableCell>
                            {!hasVariants && (
                              <Checkbox
                                checked={selectedProductVariants[prod._id] === null}
                                onCheckedChange={() => toggleProductVariant(prod._id, null)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{prod.name}</TableCell>
                          <TableCell>
                            {hasVariants ? (
                              <div className="flex flex-wrap gap-2 py-1">
                                {prod.variants.map((v: any) => {
                                  const label = [v.color, v.size].filter(Boolean).join(' / ');
                                  const isSelected = selectedProductVariants[prod._id] === v._id;
                                  return (
                                    <Button
                                      key={v._id}
                                      type="button"
                                      variant={isSelected ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => toggleProductVariant(prod._id, v._id)}
                                      className="text-xs py-0.5 px-2 h-7"
                                    >
                                      {label} (৳{v.salePrice || v.price})
                                    </Button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Standard Item</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!hasVariants && `৳${prod.salePrice || prod.price}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">{selectedCount} items selected</span>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setProductPickerOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddSelectedProducts} className="bg-primary text-primary-foreground">Add Selected</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Detail View Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => { if (!open) setSelectedBill(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  Bill Invoice
                  <span className="text-primary font-black">#{selectedBill.invoiceNo}</span>
                  <Badge
                    variant={selectedBill.status === 'Paid' ? 'default' : 'destructive'}
                    className={`ml-auto text-xs ${selectedBill.status === 'Paid' ? 'bg-green-600 text-white border-none' : ''}`}
                  >
                    {selectedBill.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Client + Bill Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/40 rounded-lg p-4 space-y-2.5 border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Details</p>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold">{selectedBill.clientName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-primary shrink-0" />
                      <span>{selectedBill.clientPhone}</span>
                    </div>
                    {selectedBill.clientEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">{selectedBill.clientEmail}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{selectedBill.clientAddress}</span>
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4 space-y-2.5 border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill Info</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-mono font-bold">{selectedBill.invoiceNo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                      <span>{format(new Date(selectedBill.date), 'dd MMM yyyy, hh:mm a')}</span>
                    </div>
                    {selectedBill.expectedReceivableDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="text-orange-600">Due by: {format(new Date(selectedBill.expectedReceivableDate), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-muted-foreground">VAT & Tax:</span>
                      <span className="font-medium">{selectedBill.vatTaxIncluded !== false ? 'Included' : 'Excluded'}</span>
                    </div>
                  </div>
                </div>

                {/* Product / Order Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-primary px-4 py-2.5 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary-foreground" />
                    <span className="text-sm font-bold text-primary-foreground">Order Items</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Title/Description</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground">Qty</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Rate (৳)</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Amount (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedBill.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2.5 max-w-md whitespace-normal break-words">
                            <div className="font-medium leading-snug">{item.name}</div>
                            {item.description && (
                              <div 
                                className="text-xs text-muted-foreground mt-1 break-words leading-relaxed [&_p]:my-0.5 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal"
                                dangerouslySetInnerHTML={{ __html: generateDescriptionHtml(item.description) }}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right">{Math.round(item.price).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{Math.round(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="bg-muted/30 border rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Summary</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>৳{Math.round(selectedBill.subtotal || 0).toLocaleString()}</span>
                  </div>
                  {selectedBill.deliveryCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Charge</span>
                      <span>+ ৳{Math.round(selectedBill.deliveryCharge).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedBill.serviceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Fee</span>
                      <span>+ ৳{Math.round(selectedBill.serviceFee).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Discount
                        {selectedBill.discountType === 'percentage'
                          ? ` (${selectedBill.discountValue}%)`
                          : ''}
                      </span>
                      <span>- ৳{Math.round(selectedBill.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total Bill</span>
                    <span className="font-semibold">৳{Math.round(selectedBill.total || 0).toLocaleString()}</span>
                  </div>
                  {selectedBill.prevDue > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Previous Due</span>
                      <span>+ ৳{Math.round(selectedBill.prevDue).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold text-base">Grand Total</span>
                    <span className="font-bold text-base text-primary">৳{Math.round(selectedBill.gTotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Cash Received</span>
                    <span className="font-semibold">৳{Math.round(selectedBill.cashIn || 0).toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between border-t pt-2 font-bold text-base ${selectedBill.currentBillDue > 0 ? 'text-destructive' : 'text-green-600'
                    }`}>
                    <span>Remaining Due</span>
                    <span>৳{Math.round(selectedBill.currentBillDue || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 font-bold text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700 min-w-[140px]"
                    onClick={() => {
                      const b = selectedBill;
                      setSelectedBill(null);
                      handleOpenTransactionHistory(b);
                    }}
                  >
                    <History className="h-4 w-4 mr-2" /> Payment History
                  </Button>
                  <Button
                    className="flex-1 font-bold min-w-[130px]"
                    onClick={() => generateBillPDF(selectedBill, settings, 'download')}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 font-bold min-w-[120px]"
                    onClick={() => generateBillPDF(selectedBill, settings, 'print')}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print Bill
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 min-w-[130px]"
                    onClick={() => generatePaymentReceiptPDF(selectedBill, settings)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Print Receipt
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bill Payment & Transaction History Modal ── */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => { setHistoryModalOpen(open); if (!open) { setHistoryData(null); setSelectedHistoryBill(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="h-5 w-5 text-purple-600" />
              Payment & Transaction History
              {selectedHistoryBill && (
                <Badge variant="outline" className="font-mono text-sm bg-purple-50 text-purple-700 border-purple-200">
                  #{selectedHistoryBill.invoiceNo}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-14 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm text-muted-foreground">Loading transaction records...</p>
            </div>
          ) : selectedHistoryBill && (
            <div className="space-y-5 pt-1">
              {/* Client & Bill Info Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-base">{selectedHistoryBill.clientName}</span>
                    <Badge variant={selectedHistoryBill.status === 'Paid' ? 'default' : 'destructive'} className={selectedHistoryBill.status === 'Paid' ? 'bg-green-600 text-white border-none' : ''}>
                      {selectedHistoryBill.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedHistoryBill.clientPhone}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Bill Date: {format(new Date(selectedHistoryBill.date), 'dd MMM yyyy')}</span>
                  </div>
                </div>

                {selectedHistoryBill.status === 'Due' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={() => {
                      handleUpdateStatus(selectedHistoryBill._id, selectedHistoryBill.currentBillDue);
                      setHistoryModalOpen(false);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" /> Collect Next Payment
                  </Button>
                )}
              </div>

              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grand Total</p>
                  <p className="text-lg font-black text-foreground">৳{Math.round(selectedHistoryBill.gTotal || 0).toLocaleString()}</p>
                </div>
                <div className="p-3.5 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">Total Paid (Cash-in)</p>
                  <p className="text-lg font-black text-green-600">৳{Math.round(selectedHistoryBill.cashIn || 0).toLocaleString()}</p>
                </div>
                <div className={`p-3.5 rounded-lg border space-y-1 ${selectedHistoryBill.currentBillDue > 0 ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20' : 'border-muted bg-muted/20'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${selectedHistoryBill.currentBillDue > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-muted-foreground'}`}>Remaining Due</p>
                  <p className={`text-lg font-black ${selectedHistoryBill.currentBillDue > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>৳{Math.round(selectedHistoryBill.currentBillDue || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Payment Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-bold text-primary">
                    {Math.min(100, Math.round(((selectedHistoryBill.cashIn || 0) / (selectedHistoryBill.gTotal || 1)) * 100))}%
                    {selectedHistoryBill.currentBillDue <= 0 ? ' (Fully Paid)' : ''}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, Math.round(((selectedHistoryBill.cashIn || 0) / (selectedHistoryBill.gTotal || 1)) * 100)))}%` }}
                  />
                </div>
              </div>

              {/* Installments Breakdown List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-purple-600" />
                    Payment Installments ({historyData?.installments?.length || 0})
                  </h4>
                  <span className="text-xs text-muted-foreground">Step-by-step transaction logs</span>
                </div>

                {(!historyData?.installments || historyData.installments.length === 0) ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/20 text-muted-foreground text-sm">
                    No payment transactions recorded for this bill yet.
                  </div>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden bg-card">
                    {historyData.installments.map((inst: any, idx: number) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            #{inst.installmentNo}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">{inst.description || `Payment Step #${inst.installmentNo}`}</span>
                              {idx === 0 && (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 py-0 font-bold">
                                  Latest
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[11px] bg-muted/50 py-0">
                                {inst.method || 'Cash'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(inst.date), 'dd MMM yyyy, hh:mm a')}</span>
                              <span>•</span>
                              <span>Remaining Due: <strong className={inst.remainingDueAfter > 0 ? 'text-orange-600' : 'text-green-600'}>৳{Math.round(inst.remainingDueAfter).toLocaleString()}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-green-600">
                              + ৳{Math.round(inst.amount).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Total paid so far: ৳{Math.round(inst.cumulativePaid).toLocaleString()}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => {
                              const chronologicalPayments = historyData?.installments
                                ? [...historyData.installments]
                                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                    .map((i: any) => ({ _id: i.txId, amount: i.amount, date: i.date }))
                                : [];

                              generatePaymentReceiptPDF(
                                {
                                  ...selectedHistoryBill,
                                  payments: chronologicalPayments
                                },
                                settings,
                                inst.amount,
                                inst.date,
                                inst.txId,
                                false
                              );
                            }}
                            title="Print receipt for this installment"
                          >
                            <Printer className="h-3.5 w-3.5 mr-1" /> Receipt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex justify-between items-center sm:justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setHistoryModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  className="font-bold text-primary border-primary/20 hover:bg-primary/10"
                  onClick={() => {
                    const b = selectedHistoryBill;
                    setHistoryModalOpen(false);
                    setSelectedBill(b);
                  }}
                >
                  <Eye className="h-4 w-4 mr-1.5" /> View Full Bill
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientBillsPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ClientBillsContent />
    </Suspense>
  );
}
