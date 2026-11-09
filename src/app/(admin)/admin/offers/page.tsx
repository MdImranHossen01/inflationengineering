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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Trash2,
  Printer,
  Download,
  Search,
  FileText,
  Eye,
  MapPin,
  Phone,
  User,
  Mail,
  CalendarDays,
  Hash,
  ArrowRight,
  MoreHorizontal,
  Edit,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { generateBillPDF, generateDescriptionHtml } from '@/lib/bill-invoice-generator';
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
      const BLOCK_TYPES = new Set(['paragraph','heading','blockquote','bulletList','orderedList','listItem','codeBlock','horizontalRule']);
      const getText = (node: any, isBlock?: boolean): string => {
        if (node.type === 'text') return node.text || '';
        if (node.type === 'hardBreak') return '\n';
        if (node.content && Array.isArray(node.content)) {
          const inner = node.content.map((n: any) => getText(n)).join('');
          if (BLOCK_TYPES.has(node.type)) return inner + '\n';
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

function ClientOffersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [offers, setOffers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const [currentPage, setCurrentPage] = useState(initialPage);

  const [settings, setSettings] = useState<any>(null);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    router.push(`/admin/offers?${params.toString()}`);
  }, [currentPage]);



  // Offer detail view state
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [editingOffer, setEditingOffer] = useState<any>(null);

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [termsAndConditions, setTermsAndConditions] = useState<string>('');
  const [vatTaxIncluded, setVatTaxIncluded] = useState<boolean>(true);
  const [billItems, setBillItems] = useState<BillItemInput[]>([
    { name: '', description: '', quantity: 1, price: 0 }
  ]);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Auto suggestion states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeSuggestions, setActiveSuggestions] = useState<any[]>([]);
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<'name' | 'email' | 'phone' | null>(null);

  // Product multi-select state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProductVariants, setSelectedProductVariants] = useState<Record<string, string | null>>({});
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // Phone validation
  const [phoneError, setPhoneError] = useState('');

  // ── Convert to Client Bill modal state ──
  const [isConvertBillOpen, setIsConvertBillOpen] = useState(false);
  const [convertBillLoading, setConvertBillLoading] = useState(false);
  const [convertingFromOffer, setConvertingFromOffer] = useState<any>(null);
  const [cbClientName, setCbClientName] = useState('');
  const [cbClientPhone, setCbClientPhone] = useState('');
  const [cbClientEmail, setCbClientEmail] = useState('');
  const [cbClientAddress, setCbClientAddress] = useState('');
  const [cbItems, setCbItems] = useState<BillItemInput[]>([{ name: '', description: '', quantity: 1, price: 0 }]);
  const [cbDeliveryCharge, setCbDeliveryCharge] = useState<number>(0);
  const [cbServiceFee, setCbServiceFee] = useState<number>(0);
  const [cbDiscountType, setCbDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [cbDiscountValue, setCbDiscountValue] = useState<number>(0);
  const [cbPrevDue, setCbPrevDue] = useState<number>(0);
  const [cbCashIn, setCbCashIn] = useState<number>(0);
  const [cbExpectedDate, setCbExpectedDate] = useState('');
  const [cbVatTaxIncluded, setCbVatTaxIncluded] = useState<boolean>(true);
  const [cbPhoneError, setCbPhoneError] = useState('');
  const [cbProductPickerOpen, setCbProductPickerOpen] = useState(false);
  const [cbProductSearchTerm, setCbProductSearchTerm] = useState('');
  const [cbSelectedVariants, setCbSelectedVariants] = useState<Record<string, string | null>>({});

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

  const fetchOffers = async () => {
    try {
      // Defer state update to microtask queue to avoid synchronous setState inside useEffect warning
      await Promise.resolve();
      setLoading(true);
      const res = await fetch('/api/admin/bills?type=offer');
      if (!res.ok) throw new Error('Failed to fetch offers');
      const data = await res.json();
      setOffers(data);
    } catch (error) {
      toast.error('Failed to load offers');
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
      fetchOffers();
      fetchProducts();
      fetchSettings();
      fetchSuggestions();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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

  // Calculations
  const subtotal = billItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity as any) || 0;
    const price = parseFloat(item.price as any) || 0;
    return sum + (price * qty);
  }, 0);
  const discount = discountType === 'percentage'
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;
  const total = Math.max(0, subtotal + deliveryCharge + serviceFee - discount);

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
        newItems.push({ name: prod.name, description: extractTextFromDescription(prod.description), price: prod.salePrice || prod.price || 0, quantity: 1 });
      } else {
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
      updated[index].quantity = value === '' ? '' as any : Math.max(1, parseInt(value) || 1);
    } else if (field === 'price') {
      updated[index].price = value === '' ? '' as any : Math.max(0, parseFloat(value) || 0);
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

    const validItems = billItems
      .filter(item => item.name.trim() !== '')
      .map(item => ({
        ...item,
        quantity: Math.max(1, parseInt(item.quantity as any) || 1),
        price: Math.max(0, parseFloat(item.price as any) || 0)
      }));
    if (validItems.length === 0) {
      toast.error('At least one item with a name is required');
      return;
    }

    try {
      setFormLoading(true);
      const offerData = {
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
        prevDue: 0,
        gTotal: total,
        cashIn: 0,
        currentBillDue: total,
        status: 'Due',
        documentType: 'offer',
        expectedDeliveryDate: expectedDeliveryDate || '',
        termsAndConditions: termsAndConditions || '',
        vatTaxIncluded: vatTaxIncluded !== undefined ? vatTaxIncluded : true
      };

      const url = editingOffer ? `/api/admin/bills/${editingOffer._id}` : '/api/admin/bills';
      const method = editingOffer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${editingOffer ? 'update' : 'create'} quotation`);
      }

      const createdOffer = await res.json();
      toast.success(editingOffer ? 'Quotation updated successfully!' : 'Quotation generated successfully!');

      setIsCreateOpen(false);
      resetForm();
      fetchOffers();
      fetchSuggestions();
    } catch (error: any) {
      toast.error(error.message || 'Error creating quotation');
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
    setSelectedProductVariants({});
    setProductSearchTerm('');
    setProductPickerOpen(false);
    setEditingOffer(null);
    setExpectedDeliveryDate('');
    setTermsAndConditions('');
    setVatTaxIncluded(true);
    setActiveSuggestions([]);
    setShowSuggestionsFor(null);
  };

  const handleConvertToChalan = async (offer: any) => {
    const result = await Swal.fire({
      title: 'Convert to Delivery Challan?',
      text: `Do you want to create a Delivery Challan from Quotation ${offer.invoiceNo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Convert',
      cancelButtonText: 'No'
    });

    if (result.isConfirmed) {
      try {
        const challanData = {
          clientName: offer.clientName,
          clientPhone: offer.clientPhone,
          clientEmail: offer.clientEmail || undefined,
          clientAddress: offer.clientAddress,
          items: offer.items,
          subtotal: offer.subtotal,
          deliveryCharge: offer.deliveryCharge,
          discountType: offer.discountType,
          discountValue: offer.discountValue,
          discount: offer.discount,
          total: offer.total,
          prevDue: 0,
          gTotal: offer.total,
          cashIn: 0,
          currentBillDue: offer.total,
          status: 'Due',
          vatTaxIncluded: offer.vatTaxIncluded !== undefined ? offer.vatTaxIncluded : true,
          documentType: 'chalan',
          convertedFrom: offer._id
        };

        const res = await fetch('/api/admin/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(challanData)
        });

        if (!res.ok) throw new Error('Conversion failed');
        const createdChallan = await res.json();

        await Swal.fire({
          title: 'Success!',
          text: `Delivery Challan ${createdChallan.invoiceNo} has been generated.`,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Print Challan Now',
          cancelButtonText: 'Close'
        }).then((printRes) => {
          if (printRes.isConfirmed) {
            generateBillPDF(createdChallan, settings, 'print');
          }
        });
      } catch (error) {
        toast.error('Failed to convert to challan');
      }
    }
  };

  const handleConvertToBill = (offer: any) => {
    // Pre-fill convert bill form with offer data
    setConvertingFromOffer(offer);
    setCbClientName(offer.clientName || '');
    setCbClientPhone(offer.clientPhone || '');
    setCbClientEmail(offer.clientEmail || '');
    setCbClientAddress(offer.clientAddress || '');
    setCbItems(
      Array.isArray(offer.items) && offer.items.length > 0
        ? offer.items.map((it: any) => ({ name: it.name || '', description: it.description || '', quantity: it.quantity || 1, price: it.price || 0 }))
        : [{ name: '', description: '', quantity: 1, price: 0 }]
    );
    setCbDeliveryCharge(offer.deliveryCharge || 0);
    setCbServiceFee(offer.serviceFee || 0);
    setCbDiscountType(offer.discountType || 'fixed');
    setCbDiscountValue(offer.discountValue || 0);
    setCbPrevDue(0);
    setCbCashIn(0);
    setCbExpectedDate('');
    setCbVatTaxIncluded(offer.vatTaxIncluded !== undefined ? offer.vatTaxIncluded : true);
    setCbPhoneError('');
    setCbSelectedVariants({});
    setCbProductSearchTerm('');
    setCbProductPickerOpen(false);
    setIsConvertBillOpen(true);
  };

  const resetConvertBillForm = () => {
    setConvertingFromOffer(null);
    setCbClientName('');
    setCbClientPhone('');
    setCbClientEmail('');
    setCbClientAddress('');
    setCbItems([{ name: '', description: '', quantity: 1, price: 0 }]);
    setCbDeliveryCharge(0);
    setCbServiceFee(0);
    setCbDiscountType('fixed');
    setCbDiscountValue(0);
    setCbPrevDue(0);
    setCbCashIn(0);
    setCbExpectedDate('');
    setCbVatTaxIncluded(true);
    setCbPhoneError('');
    setCbSelectedVariants({});
    setCbProductSearchTerm('');
    setCbProductPickerOpen(false);
  };

  const cbSubtotal = cbItems.reduce((sum, item) => sum + ((parseFloat(item.price as any) || 0) * (parseInt(item.quantity as any) || 1)), 0);
  const cbDiscount = cbDiscountType === 'percentage' ? Math.round((cbSubtotal * cbDiscountValue) / 100) : cbDiscountValue;
  const cbTotal = Math.max(0, cbSubtotal + cbDeliveryCharge + cbServiceFee - cbDiscount);
  const cbGTotal = cbTotal + cbPrevDue;
  const cbCurrentDue = Math.max(0, cbGTotal - cbCashIn);
  const cbCalculatedStatus = cbCurrentDue <= 0 ? 'Paid' : 'Due';

  const validateCbPhone = (phone: string) => {
    const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    if (!phone.trim()) { setCbPhoneError('Phone number is required'); return false; }
    if (!bdPhoneRegex.test(phone.replace(/\s/g, ''))) { setCbPhoneError('Enter a valid BD number (e.g. 017XXXXXXXX)'); return false; }
    setCbPhoneError('');
    return true;
  };

  const handleConvertBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbClientName.trim() || !cbClientAddress.trim()) { toast.error('Client details are required'); return; }
    if (!validateCbPhone(cbClientPhone)) { toast.error('Please enter a valid Bangladesh phone number'); return; }
    const validItems = cbItems.filter(it => it.name.trim() !== '').map(it => ({ ...it, quantity: Math.max(1, parseInt(it.quantity as any) || 1), price: Math.max(0, parseFloat(it.price as any) || 0) }));
    if (validItems.length === 0) { toast.error('At least one item is required'); return; }
    if (cbCalculatedStatus === 'Due' && !cbExpectedDate) { toast.error('Expected receivable date is required for due bills'); return; }
    try {
      setConvertBillLoading(true);
      const billData = {
        clientName: cbClientName,
        clientPhone: cbClientPhone,
        clientEmail: cbClientEmail.trim() || undefined,
        clientAddress: cbClientAddress,
        items: validItems,
        subtotal: cbSubtotal,
        deliveryCharge: cbDeliveryCharge,
        serviceFee: cbServiceFee,
        discountType: cbDiscountType,
        discountValue: cbDiscountValue,
        discount: cbDiscount,
        total: cbTotal,
        prevDue: cbPrevDue,
        gTotal: cbGTotal,
        cashIn: cbCashIn,
        currentBillDue: cbCurrentDue,
        status: cbCalculatedStatus,
        expectedReceivableDate: cbCalculatedStatus === 'Due' ? cbExpectedDate : undefined,
        vatTaxIncluded: cbVatTaxIncluded,
        documentType: 'bill',
        convertedFrom: convertingFromOffer?._id
      };
      const res = await fetch('/api/admin/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(billData) });
      if (!res.ok) throw new Error('Failed to create bill');
      const createdBill = await res.json();
      setIsConvertBillOpen(false);
      resetConvertBillForm();
      // Show success with print option (direct user click avoids popup blocker)
      await Swal.fire({
        title: 'Bill Generated!',
        text: `Client Bill ${createdBill.invoiceNo} has been created successfully.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Print Bill Now',
        cancelButtonText: 'Close'
      }).then((printRes) => {
        if (printRes.isConfirmed) {
          generateBillPDF(createdBill, settings, 'print');
        }
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create bill');
    } finally {
      setConvertBillLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
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
        const res = await fetch(`/api/admin/bills/${offerId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete quotation');
        toast.success('Quotation deleted successfully');
        fetchOffers();
      } catch (error) {
        toast.error('Failed to delete quotation');
      }
    }
  };

  const filteredOffers = offers.filter(b =>
    b.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.clientPhone.includes(searchTerm) ||
    b.invoiceNo.includes(searchTerm)
  );

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredOffers.length / ITEMS_PER_PAGE);
  const paginatedOffers = filteredOffers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="flex-1 space-y-6 px-[2px] md:px-4 py-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Client Quotations / Offers</h2>
          <p className="text-muted-foreground text-sm">Create, manage, and print price offers for clients, and convert them to Delivery Challans.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="w-full md:w-auto bg-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Create Offer / Quote
        </Button>
      </div>

      {/* Offers Table */}
      <Card>
        <CardHeader className="px-4 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Quotations List</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client or invoice..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (currentPage !== 1) {
                    setCurrentPage(1);
                  }
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 stroke-1" />
              <p>No quotations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Quotation No</TableHead>
                    <TableHead className="min-w-[280px]">Client Name</TableHead>
                    <TableHead className="w-[130px]">Phone</TableHead>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead className="text-right w-[140px]">Total Offer (৳)</TableHead>
                    <TableHead className="text-right w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOffers.map((offer) => (
                    <TableRow key={offer._id}>
                      <TableCell className="font-semibold whitespace-nowrap">{offer.invoiceNo}</TableCell>
                      <TableCell className="whitespace-normal break-words leading-snug">
                        {offer.clientName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{offer.clientPhone}</TableCell>
                      <TableCell className="whitespace-nowrap w-[110px]">{format(new Date(offer.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap w-[140px]">৳{Math.round(offer.total)}</TableCell>
                      <TableCell className="text-right w-[90px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            onClick={() => generateBillPDF(offer, settings, 'print')}
                            title="Print Quotation"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedOffer(offer)}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingOffer(offer);
                                  setClientName(offer.clientName);
                                  setClientPhone(offer.clientPhone);
                                  setClientEmail(offer.clientEmail || '');
                                  setClientAddress(offer.clientAddress);
                                  setBillItems(offer.items);
                                  setDeliveryCharge(offer.deliveryCharge);
                                  setServiceFee(offer.serviceFee || 0);
                                  setDiscountType(offer.discountType || 'fixed');
                                  setDiscountValue(offer.discountValue || 0);
                                  let formattedExpDate = '';
                                  if (offer.expectedDeliveryDate) {
                                    try {
                                      formattedExpDate = format(new Date(offer.expectedDeliveryDate), 'yyyy-MM-dd');
                                    } catch (e) {
                                      formattedExpDate = String(offer.expectedDeliveryDate).substring(0, 10);
                                    }
                                  }
                                  setExpectedDeliveryDate(formattedExpDate);
                                  setTermsAndConditions(offer.termsAndConditions || '');
                                  setVatTaxIncluded(offer.vatTaxIncluded !== undefined ? offer.vatTaxIncluded : true);
                                  setIsCreateOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit Offer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateBillPDF(offer, settings, 'download')}>
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateBillPDF(offer, settings, 'print')}>
                                <Printer className="mr-2 h-4 w-4" /> Print PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleConvertToChalan(offer)}>
                                <ArrowRight className="mr-2 h-4 w-4" /> Convert to Challan
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleConvertToBill(offer)}>
                                <FileText className="mr-2 h-4 w-4" /> Convert to Client Bill
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteOffer(offer._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="py-4 border-t bg-background px-6 mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'Edit' : 'Create New'} Quotation / Offer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Info with Auto Suggestion (2 rows x 2 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border">
              {/* Client Name */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="cName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Client Name *
                </Label>
                <Input
                  id="cName"
                  placeholder="e.g. Rahim & Bros"
                  value={clientName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestionsFor(null), 250)}
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
                <Label htmlFor="cPhone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Client Phone *
                </Label>
                <Input
                  id="cPhone"
                  placeholder="e.g. 017XXXXXXXX"
                  value={clientPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={(e) => {
                    validatePhone(e.target.value);
                    setTimeout(() => setShowSuggestionsFor(null), 250);
                  }}
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
                <Label htmlFor="cEmail" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email (Optional)
                </Label>
                <Input
                  id="cEmail"
                  type="email"
                  placeholder="e.g. client@example.com"
                  value={clientEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestionsFor(null), 250)}
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
                <Label htmlFor="cAddr" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Client Address *
                </Label>
                <Input
                  id="cAddr"
                  placeholder="e.g. Banani, Dhaka"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="h-10 text-sm bg-background"
                  required
                />
              </div>
            </div>

            {/* Product Picker */}
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Items List</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProductPickerOpen(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Select Products
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow} className="font-bold">
                  <Plus className="h-3 w-3 mr-1" /> Add Custom Item
                </Button>
              </div>
            </div>

            {/* Manual item entries */}
            <div className="space-y-3">
              {billItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
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
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="Price"
                      min="0"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItemRow(index)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <hr />

            {/* Calculations & Discounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="discType">Discount Type</Label>
                    <Select
                      value={discountType}
                      onValueChange={(val: any) => { setDiscountType(val); setDiscountValue(0); }}
                    >
                      <SelectTrigger id="discType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount (৳)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="discVal">Discount Value</Label>
                    <Input
                      id="discVal"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delCharge">Delivery Charge (৳)</Label>
                    <Input
                      id="delCharge"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={deliveryCharge || ''}
                      onChange={(e) => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceFeeOffer">Service Fee (৳) <span className="text-muted-foreground font-normal text-xs">— Optional</span></Label>
                    <Input
                      id="serviceFeeOffer"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={serviceFee || ''}
                      onChange={(e) => setServiceFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery Date <span className="text-muted-foreground font-normal text-xs">— Optional</span></Label>
                    <Input
                      id="expectedDeliveryDate"
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
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

                <div className="space-y-2">
                  <Label htmlFor="termsAndConditions">Terms & Conditions <span className="text-muted-foreground font-normal text-xs">— Optional</span></Label>
                  <textarea
                    id="termsAndConditions"
                    placeholder="Enter terms and conditions..."
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">৳{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount:</span>
                    <span>- ৳{discount}</span>
                  </div>
                )}
                {deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>৳{deliveryCharge}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between">
                    <span>Service Fee:</span>
                    <span>৳{serviceFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Offer Value:</span>
                  <span>৳{total}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading} className="bg-primary text-primary-foreground">
                {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOffer ? 'Update Offer' : 'Generate Offer'}
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

      {/* Offer Detail View Dialog */}
      <Dialog open={!!selectedOffer} onOpenChange={(open) => { if (!open) setSelectedOffer(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation Details — {selectedOffer?.invoiceNo}</DialogTitle>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-xs">Quotation To</h4>
                  <p className="font-medium text-base break-words">{selectedOffer.clientName}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /> {selectedOffer.clientPhone}</p>
                  {selectedOffer.clientEmail && (
                    <p className="flex items-center gap-1.5 mt-1 text-muted-foreground break-all"><Mail className="h-3.5 w-3.5 shrink-0" /> {selectedOffer.clientEmail}</p>
                  )}
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground break-words"><MapPin className="h-3.5 w-3.5 shrink-0" /> {selectedOffer.clientAddress}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-xs">Document Info</h4>
                  <p className="flex items-center gap-1.5 font-medium"><Hash className="h-3.5 w-3.5 text-primary shrink-0" /> {selectedOffer.invoiceNo}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> {format(new Date(selectedOffer.date), 'dd MMM yyyy')}</p>
                  {selectedOffer.expectedDeliveryDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Exp. Delivery:</strong> {format(new Date(selectedOffer.expectedDeliveryDate), 'dd MMM yyyy')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>VAT & Tax:</strong> {selectedOffer.vatTaxIncluded !== false ? 'Included' : 'Excluded'}
                  </p>
                </div>
              </div>

              {selectedOffer.termsAndConditions && (
                <div className="text-xs bg-muted/50 p-2.5 rounded border">
                  <span className="font-semibold text-muted-foreground block mb-1">Terms & Conditions:</span>
                  <p className="whitespace-pre-wrap break-words">{selectedOffer.termsAndConditions}</p>
                </div>
              )}

              <div className="border rounded-md overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="min-w-[200px]">Title/Description</TableHead>
                      <TableHead className="text-center w-16 whitespace-nowrap">Qty</TableHead>
                      <TableHead className="text-right w-24 whitespace-nowrap">Rate</TableHead>
                      <TableHead className="text-right w-28 whitespace-nowrap">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOffer.items.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-md whitespace-normal break-words">
                          <div className="font-medium leading-snug">{item.name}</div>
                          {item.description && (
                            <div 
                              className="text-xs text-muted-foreground mt-1 break-words leading-relaxed [&_p]:my-0.5 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal"
                              dangerouslySetInnerHTML={{ __html: generateDescriptionHtml(item.description) }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">{item.quantity}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">৳{Math.round(item.price)}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">৳{Math.round(item.price * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">৳{Math.round(selectedOffer.subtotal)}</span>
                  </div>
                  {selectedOffer.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount ({selectedOffer.discountType === 'percentage' ? `${selectedOffer.discountValue}%` : 'Fixed'}):</span>
                      <span>- ৳{Math.round(selectedOffer.discount)}</span>
                    </div>
                  )}
                  {selectedOffer.deliveryCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Charge:</span>
                      <span>৳{Math.round(selectedOffer.deliveryCharge)}</span>
                    </div>
                  )}
                  {selectedOffer.serviceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Fee:</span>
                      <span>৳{Math.round(selectedOffer.serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total Offer:</span>
                    <span className="text-primary">৳{Math.round(selectedOffer.total)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateBillPDF(selectedOffer, settings, 'print')}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print Quotation
                </Button>
                <Button
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  onClick={() => {
                    const off = selectedOffer;
                    setSelectedOffer(null);
                    handleConvertToBill(off);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" /> Convert to Client Bill
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={() => {
                    const off = selectedOffer;
                    setSelectedOffer(null);
                    handleConvertToChalan(off);
                  }}
                >
                  <ArrowRight className="mr-2 h-4 w-4" /> Convert to Challan
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Convert to Client Bill Dialog ── */}
      <Dialog open={isConvertBillOpen} onOpenChange={(open) => { setIsConvertBillOpen(open); if (!open) resetConvertBillForm(); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Client Bill{convertingFromOffer ? ` — from ${convertingFromOffer.invoiceNo}` : ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConvertBillSubmit} className="space-y-6">
            {/* Client Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border">
              <div className="space-y-1.5">
                <Label htmlFor="cb-clientName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Client Name *
                </Label>
                <input
                  id="cb-clientName"
                  value={cbClientName}
                  onChange={(e) => setCbClientName(e.target.value)}
                  placeholder="e.g. Rahim Khan"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cb-clientPhone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Client Phone *
                </Label>
                <input
                  id="cb-clientPhone"
                  value={cbClientPhone}
                  onChange={(e) => { setCbClientPhone(e.target.value); if (cbPhoneError) validateCbPhone(e.target.value); }}
                  onBlur={(e) => validateCbPhone(e.target.value)}
                  placeholder="e.g. 01712345678"
                  className={`h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cbPhoneError ? 'border-destructive' : 'border-input'}`}
                  required
                />
                {cbPhoneError && <p className="text-[11px] text-destructive mt-0.5">{cbPhoneError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cb-clientEmail" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email (Optional)
                </Label>
                <input
                  id="cb-clientEmail"
                  type="email"
                  value={cbClientEmail}
                  onChange={(e) => setCbClientEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cb-clientAddress" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Client Address *
                </Label>
                <input
                  id="cb-clientAddress"
                  value={cbClientAddress}
                  onChange={(e) => setCbClientAddress(e.target.value)}
                  placeholder="e.g. Nawabpur, Dhaka"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
            </div>

            {/* Bill Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Bill Items</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => setCbItems(prev => [...prev, { name: '', description: '', quantity: 1, price: 0 }])} className="font-bold">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {cbItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1 space-y-1">
                      <input
                        placeholder="Title"
                        value={item.name}
                        onChange={(e) => { const u = [...cbItems]; u[index].name = e.target.value; setCbItems(u); }}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        required
                      />
                      <input
                        placeholder="Description (Optional)"
                        value={item.description || ''}
                        onChange={(e) => { const u = [...cbItems]; u[index].description = e.target.value; setCbItems(u); }}
                        className="h-8 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <input
                      type="number" placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => { const u = [...cbItems]; u[index].quantity = Math.max(1, parseInt(e.target.value) || 1); setCbItems(u); }}
                      className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      min="1"
                    />
                    <input
                      type="number" placeholder="Rate"
                      value={item.price || ''}
                      onChange={(e) => { const u = [...cbItems]; u[index].price = Math.max(0, parseFloat(e.target.value) || 0); setCbItems(u); }}
                      className="w-28 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      min="0"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => { if (cbItems.length === 1) { setCbItems([{ name: '', description: '', quantity: 1, price: 0 }]); } else { setCbItems(cbItems.filter((_, i) => i !== index)); } }} className="text-destructive hover:bg-destructive/10 shrink-0 h-9 w-9">
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
                    <Label htmlFor="cb-deliveryCharge">Delivery Charge (৳)</Label>
                    <input id="cb-deliveryCharge" type="number" value={cbDeliveryCharge || ''} onChange={(e) => setCbDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cb-serviceFee">Service Fee (৳) <span className="text-muted-foreground font-normal text-xs">— Optional</span></Label>
                    <input id="cb-serviceFee" type="number" value={cbServiceFee || ''} placeholder="0" onChange={(e) => setCbServiceFee(Math.max(0, parseFloat(e.target.value) || 0))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cb-prevDue">Previous Due (৳)</Label>
                  <input id="cb-prevDue" type="number" value={cbPrevDue || ''} onChange={(e) => setCbPrevDue(Math.max(0, parseFloat(e.target.value) || 0))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="space-y-2 col-span-1">
                    <Label>Discount Type</Label>
                    <Select value={cbDiscountType} onValueChange={(val: any) => { setCbDiscountType(val); setCbDiscountValue(0); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed (৳)</SelectItem>
                        <SelectItem value="percentage">Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Discount Value</Label>
                    <input type="number" value={cbDiscountValue || ''} onChange={(e) => setCbDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))} placeholder={cbDiscountType === 'percentage' ? '%' : '৳'} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cb-cashIn">Cash-in (Paid) (৳)</Label>
                    <input id="cb-cashIn" type="number" value={cbCashIn || ''} onChange={(e) => setCbCashIn(Math.max(0, parseFloat(e.target.value) || 0))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="pt-2">
                      <Badge variant={cbCalculatedStatus === 'Paid' ? 'default' : 'destructive'} className={cbCalculatedStatus === 'Paid' ? 'bg-green-600 text-white border-none' : ''}>{cbCalculatedStatus}</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {cbCalculatedStatus === 'Due' ? (
                    <div className="space-y-2">
                      <Label htmlFor="cb-expectedDate">Expected Date of Receivable *</Label>
                      <input id="cb-expectedDate" type="date" value={cbExpectedDate} onChange={(e) => setCbExpectedDate(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                  ) : <div />}
                  <div className={`flex items-center space-x-2 ${cbCalculatedStatus === 'Due' ? 'pt-6' : 'pt-2'}`}>
                    <Checkbox
                      id="cb-vatTaxIncluded"
                      checked={cbVatTaxIncluded}
                      onCheckedChange={(checked) => setCbVatTaxIncluded(checked === true)}
                    />
                    <Label htmlFor="cb-vatTaxIncluded" className="text-sm font-medium leading-none cursor-pointer">
                      VAT & Tax Included
                    </Label>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/40 p-4 rounded-lg space-y-3 border h-fit text-sm">
                <h4 className="font-bold border-b pb-2 mb-2 text-base">Bill Summary</h4>
                <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">৳{cbSubtotal.toLocaleString()}</span></div>
                {cbDeliveryCharge > 0 && <div className="flex justify-between"><span>Delivery Charge:</span><span>+ ৳{cbDeliveryCharge.toLocaleString()}</span></div>}
                {cbServiceFee > 0 && <div className="flex justify-between"><span>Service Fee:</span><span>+ ৳{cbServiceFee.toLocaleString()}</span></div>}
                {cbDiscount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount {cbDiscountType === 'percentage' && `(${cbDiscountValue}%)`}:</span><span>- ৳{cbDiscount.toLocaleString()}</span></div>}
                <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total Bill:</span><span>৳{cbTotal.toLocaleString()}</span></div>
                {cbPrevDue > 0 && <div className="flex justify-between text-muted-foreground"><span>Previous Due:</span><span>+ ৳{cbPrevDue.toLocaleString()}</span></div>}
                <div className="flex justify-between border-t pt-2 font-bold text-lg text-primary"><span>Grand Total:</span><span>৳{cbGTotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-green-700 border-t pt-2"><span>Cash-in:</span><span>৳{cbCashIn.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold text-base text-destructive"><span>Remaining Due:</span><span>৳{cbCurrentDue.toLocaleString()}</span></div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConvertBillOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={convertBillLoading} className="font-bold">
                {convertBillLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Generate Bill
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientOffersPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ClientOffersContent />
    </Suspense>
  );
}
