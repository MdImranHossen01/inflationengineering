'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Edit, Search, User, Eye, CreditCard, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/pagination';

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    router.push(`/admin/suppliers?${params.toString()}`);
  }, [currentPage]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    router.push(`/admin/suppliers?${params.toString()}`);
  }, [searchTerm]);

  // Add/Edit Dialog State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierCompany, setSupplierCompany] = useState('');

  // Details & Payments Drawer/Modal State
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [supplierBills, setSupplierBills] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Record Payment Dialog State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [payDescription, setPayDescription] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/suppliers');
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingSupplier(null);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setSupplierAddress('');
    setSupplierCompany('');
    setIsFormOpen(true);
  };

  const openEditDialog = (supplier: any) => {
    setEditingSupplier(supplier);
    setSupplierName(supplier.name);
    setSupplierPhone(supplier.phone);
    setSupplierEmail(supplier.email || '');
    setSupplierAddress(supplier.address);
    setSupplierCompany(supplier.companyName || '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName || !supplierPhone || !supplierAddress) {
      toast.error('Please fill in Name, Phone, and Address.');
      return;
    }

    try {
      const url = editingSupplier ? `/api/admin/suppliers/${editingSupplier._id}` : '/api/admin/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supplierName,
          phone: supplierPhone,
          email: supplierEmail || undefined,
          address: supplierAddress,
          companyName: supplierCompany || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to save supplier');

      toast.success(editingSupplier ? 'Supplier updated successfully' : 'Supplier added successfully');
      setIsFormOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || 'Error saving supplier');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete Supplier?',
      text: 'Are you sure you want to delete this supplier? This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete!'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete');
      }

      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete supplier');
    }
  };

  const viewSupplierDetails = async (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsDetailsOpen(true);
    fetchSupplierDetails(supplier._id);
  };

  const fetchSupplierDetails = async (id: string) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`/api/admin/suppliers/${id}`);
      if (!res.ok) throw new Error('Failed to load details');
      const data = await res.json();
      setSupplierBills(data.bills || []);
      setSupplierPayments(data.payments || []);
    } catch (error: any) {
      toast.error(error.message || 'Error fetching details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const openPaymentDialog = () => {
    setPayAmount('');
    setPayDescription('');
    setPayMethod('Cash');
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setIsPaymentOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier._id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          paymentMethod: payMethod,
          description: payDescription || undefined,
          date: payDate
        })
      });

      if (!res.ok) throw new Error('Failed to record payment');

      toast.success('Payment recorded successfully');
      setIsPaymentOpen(false);
      fetchSupplierDetails(selectedSupplier._id);
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || 'Error recording payment');
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.companyName && s.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.phone.includes(searchTerm)
  );

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 px-[2px] md:px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers / Vendors</h1>
          <p className="text-muted-foreground text-sm">Manage product suppliers and outstanding payable balances.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, company or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Outstanding Payable</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Loading suppliers...
                  </TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No suppliers found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier._id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{supplier.name}</div>
                      {supplier.companyName && (
                        <div className="text-xs text-muted-foreground">{supplier.companyName}</div>
                      )}
                    </TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{supplier.address}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-600">
                      ৳{supplier.currentBalance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => viewSupplierDetails(supplier)}>
                        <Eye className="h-4 w-4 text-sky-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)}>
                        <Edit className="h-4 w-4 text-indigo-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier._id)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
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
        </CardContent>
      </Card>

      {/* Add / Edit Supplier Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[480px] w-full">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={supplierCompany}
                onChange={(e) => setSupplierCompany(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSupplier ? 'Save Changes' : 'Add Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Detail Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center mr-6">
              <span>Supplier Statement: {selectedSupplier?.name}</span>
              <span className="text-sm font-semibold text-rose-600">
                Outstanding: ৳{selectedSupplier?.currentBalance?.toLocaleString() || 0}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-6 mt-4">
              {/* Supplier Info Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs text-muted-foreground uppercase">Phone</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 font-semibold">{selectedSupplier.phone}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs text-muted-foreground uppercase">Company</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 font-semibold">{selectedSupplier.companyName || 'N/A'}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs text-muted-foreground uppercase">Address</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 font-semibold truncate" title={selectedSupplier.address}>
                    {selectedSupplier.address}
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end">
                <Button onClick={openPaymentDialog}>
                  <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                </Button>
              </div>

              {detailsLoading ? (
                <div className="text-center py-6 text-muted-foreground">Loading history...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Purchase Bills */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Purchase Bills</h3>
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bill No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierBills.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">
                                No bills found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            supplierBills.map((bill) => (
                              <TableRow key={bill._id}>
                                <TableCell className="font-medium text-xs">{bill.billNo}</TableCell>
                                <TableCell className="text-xs">{format(new Date(bill.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="text-right text-xs">৳{bill.total.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-xs text-rose-600 font-semibold">
                                  ৳{bill.dueAmount.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Payments */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Payment History</h3>
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierPayments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                                No payments recorded.
                              </TableCell>
                            </TableRow>
                          ) : (
                            supplierPayments.map((payment) => (
                              <TableRow key={payment._id}>
                                <TableCell className="text-xs">{format(new Date(payment.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="font-semibold text-emerald-600 text-xs">
                                  ৳{payment.amount.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={payment.description}>
                                  {payment.description}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment to {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <Label htmlFor="payAmount">Amount (BDT) *</Label>
              <Input
                id="payAmount"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payMethod">Payment Method *</Label>
                <select
                  id="payMethod"
                  value={payMethod}
                  onChange={(e: any) => setPayMethod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
              <div>
                <Label htmlFor="payDate">Payment Date</Label>
                <Input
                  id="payDate"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="payDescription">Notes / Description</Label>
              <Input
                id="payDescription"
                value={payDescription}
                onChange={(e) => setPayDescription(e.target.value)}
                placeholder="e.g. Paid via Cash for monthly clearing"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Confirm Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SuppliersContent />
    </Suspense>
  );
}
