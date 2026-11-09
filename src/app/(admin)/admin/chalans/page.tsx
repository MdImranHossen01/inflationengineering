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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Edit
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

function ClientChalansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chalans, setChalans] = useState<any[]>([]);
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
    router.push(`/admin/chalans?${params.toString()}`);
  }, [currentPage]);

  // Reset page when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  // Chalan detail view state
  const [selectedChalan, setSelectedChalan] = useState<any>(null);
  const [editingChalan, setEditingChalan] = useState<any>(null);

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

  const fetchChalans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/bills?type=chalan');
      if (!res.ok) throw new Error('Failed to fetch challans');
      const data = await res.json();
      setChalans(data);
    } catch (error) {
      toast.error('Failed to load challans');
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
      fetchChalans();
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

    try {
      setFormLoading(true);
      const subtotalVal = validItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      const chalanData = {
        clientName,
        clientPhone,
        clientEmail: clientEmail.trim() || undefined,
        clientAddress,
        items: validItems,
        subtotal: subtotalVal,
        deliveryCharge: 0,
        discountType: 'fixed',
        discountValue: 0,
        discount: 0,
        total: subtotalVal,
        prevDue: 0,
        gTotal: subtotalVal,
        cashIn: 0,
        currentBillDue: subtotalVal,
        status: 'Due',
        documentType: 'chalan'
      };

      const url = editingChalan ? `/api/admin/bills/${editingChalan._id}` : '/api/admin/bills';
      const method = editingChalan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chalanData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${editingChalan ? 'update' : 'create'} challan`);
      }

      const createdChalan = await res.json();
      toast.success(editingChalan ? 'Delivery Challan updated successfully!' : 'Delivery Challan generated successfully!');

      setIsCreateOpen(false);
      resetForm();
      fetchChalans();
      fetchSuggestions();
    } catch (error: any) {
      toast.error(error.message || 'Error saving challan');
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
    setSelectedProductVariants({});
    setProductSearchTerm('');
    setProductPickerOpen(false);
    setEditingChalan(null);
    setActiveSuggestions([]);
    setShowSuggestionsFor(null);
  };

  const handleConvertToBill = async (chalan: any) => {
    const result = await Swal.fire({
      title: 'Convert to Bill Invoice?',
      text: `Do you want to create a Final Bill Invoice from Delivery Challan ${chalan.invoiceNo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Convert',
      cancelButtonText: 'No'
    });

    if (result.isConfirmed) {
      try {
        const billData = {
          clientName: chalan.clientName,
          clientPhone: chalan.clientPhone,
          clientEmail: chalan.clientEmail || undefined,
          clientAddress: chalan.clientAddress,
          items: chalan.items,
          subtotal: chalan.subtotal,
          deliveryCharge: chalan.deliveryCharge || 0,
          discountType: chalan.discountType || 'fixed',
          discountValue: chalan.discountValue || 0,
          discount: chalan.discount || 0,
          total: chalan.total,
          prevDue: 0,
          gTotal: chalan.total,
          cashIn: 0,
          currentBillDue: chalan.total,
          status: 'Due',
          vatTaxIncluded: chalan.vatTaxIncluded !== undefined ? chalan.vatTaxIncluded : true,
          documentType: 'bill',
          convertedFrom: chalan._id
        };

        const res = await fetch('/api/admin/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(billData)
        });

        if (!res.ok) throw new Error('Conversion failed');
        const createdBill = await res.json();

        await Swal.fire({
          title: 'Success!',
          text: `Final Bill Invoice ${createdBill.invoiceNo} has been generated.`,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Print Bill Now',
          cancelButtonText: 'Close'
        }).then((printRes) => {
          if (printRes.isConfirmed) {
            generateBillPDF(createdBill, settings, 'print');
          }
        });
      } catch (error) {
        toast.error('Failed to convert to bill');
      }
    }
  };

  const handleDeleteChalan = async (chalanId: string) => {
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
        const res = await fetch(`/api/admin/bills/${chalanId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete challan');
        toast.success('Delivery Challan deleted successfully');
        fetchChalans();
      } catch (error) {
        toast.error('Failed to delete challan');
      }
    }
  };

  const filteredChalans = chalans.filter(b =>
    b.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.clientPhone.includes(searchTerm) ||
    b.invoiceNo.includes(searchTerm)
  );

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredChalans.length / ITEMS_PER_PAGE);
  const paginatedChalans = filteredChalans.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="flex-1 space-y-6 px-4 py-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Delivery Challans</h2>
          <p className="text-muted-foreground text-sm">Create, manage, and print delivery challans for goods dispatched, and convert them to Bills.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="w-full md:w-auto bg-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Create Delivery Challan
        </Button>
      </div>

      {/* Challans Table */}
      <Card>
        <CardHeader className="px-4 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Challans List</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client or challan..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredChalans.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 stroke-1" />
              <p>No delivery challans found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Challan No</TableHead>
                    <TableHead className="w-[220px] max-w-[240px]">Client Name</TableHead>
                    <TableHead className="w-[140px]">Phone</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="text-right w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedChalans.map((chalan) => (
                    <TableRow key={chalan._id}>
                      <TableCell className="font-semibold whitespace-nowrap">{chalan.invoiceNo}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal break-words leading-snug">
                        {chalan.clientName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{chalan.clientPhone}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(chalan.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            onClick={() => generateBillPDF(chalan, settings, 'print')}
                            title="Print Challan"
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
                              <DropdownMenuItem onClick={() => setSelectedChalan(chalan)}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingChalan(chalan);
                                  setClientName(chalan.clientName);
                                  setClientPhone(chalan.clientPhone);
                                  setClientEmail(chalan.clientEmail || '');
                                  setClientAddress(chalan.clientAddress);
                                  setBillItems(chalan.items);
                                  setIsCreateOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit Challan
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateBillPDF(chalan, settings, 'download')}>
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateBillPDF(chalan, settings, 'print')}>
                                <Printer className="mr-2 h-4 w-4" /> Print PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleConvertToBill(chalan)}>
                                <ArrowRight className="mr-2 h-4 w-4" /> Convert to Bill
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteChalan(chalan._id)}
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
            <DialogTitle>{editingChalan ? 'Edit' : 'Create New'} Delivery Challan</DialogTitle>
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
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading} className="bg-primary text-primary-foreground">
                {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingChalan ? 'Update Challan' : 'Generate Challan'}
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
                                      {label}
                                    </Button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Standard Item</span>
                            )}
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

      {/* Chalan Detail View Dialog */}
      <Dialog open={!!selectedChalan} onOpenChange={(open) => { if (!open) setSelectedChalan(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery Challan Details — {selectedChalan?.invoiceNo}</DialogTitle>
          </DialogHeader>
          {selectedChalan && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-xs">Deliver To</h4>
                  <p className="font-medium text-base">{selectedChalan.clientName}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {selectedChalan.clientPhone}</p>
                  {selectedChalan.clientEmail && (
                    <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {selectedChalan.clientEmail}</p>
                  )}
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {selectedChalan.clientAddress}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-xs">Document Info</h4>
                  <p className="flex items-center gap-1.5 font-medium"><Hash className="h-3.5 w-3.5 text-primary" /> {selectedChalan.invoiceNo}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {format(new Date(selectedChalan.date), 'dd MMM yyyy')}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="min-w-[200px]">Title/Description</TableHead>
                      <TableHead className="text-center w-24 whitespace-nowrap">Quantity Delivered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedChalan.items.map((item: any, i: number) => (
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
                        <TableCell className="text-center font-medium whitespace-nowrap">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateBillPDF(selectedChalan, settings, 'print')}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print Challan
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={() => {
                    const ch = selectedChalan;
                    setSelectedChalan(null);
                    handleConvertToBill(ch);
                  }}
                >
                  <ArrowRight className="mr-2 h-4 w-4" /> Convert to Final Bill
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientChalansPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ClientChalansContent />
    </Suspense>
  );
}
