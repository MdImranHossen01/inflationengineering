'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import OrderDetailsDialog from '@/components/admin/OrderDetailsDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Eye,
  Package,
  Truck,
  CheckCircle,
  Trash2,
  XCircle,
  Download,
  MoreHorizontal,
  ChevronDown,
  Printer,
  FileText,
  Filter as FilterIcon,
  Search
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { generateInvoicePDF } from '@/lib/invoice-generator';
import { printStickerInvoice } from '@/lib/sticker-generator';


function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1')));

  const [orders, setOrders] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: '',
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    if (currentPage > 1) {
      setCurrentPage(1);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      router.push(`/admin/orders?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, statusFilter, dateFilter.from, dateFilter.to]);

  const handleDownloadInvoice = async (order: any) => {
    try {
      toast.info('Generating PDF invoice...');
      await generateInvoicePDF(order, settings);
    } catch (error) {
      toast.error('Failed to generate PDF invoice');
    }
  };

  const handlePrint = async (ids: string[]) => {
    const toPrint = orders.filter(o => ids.includes(o._id));
    if (toPrint.length === 0) {
      toast.error('No orders found to print');
      return;
    }
    toast.info(`Generating ${toPrint.length > 1 ? toPrint.length + ' invoices' : 'invoice'}...`);
    await generateInvoicePDF(toPrint, settings, 'print');
  };

  const handlePrintStickers = async (ids: string[]) => {
    const toPrint = orders.filter(o => ids.includes(o._id));
    if (toPrint.length === 0) {
      toast.error('No orders found to print');
      return;
    }
    toast.info('Preparing sticker invoice...');
    await printStickerInvoice(toPrint, settings);
  };

  const fetchOrders = async (pageVal = currentPage) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        all: 'true',
        page: pageVal.toString(),
        limit: '20',
        search: debouncedSearchTerm,
        status: statusFilter,
        from: dateFilter.from,
        to: dateFilter.to,
      });
      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load orders: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      // Support both paginated { orders, totalPages, totalCount } and plain array responses
      if (Array.isArray(data)) {
        setOrders(data);
        setTotalPages(1);
        setTotalCount(data.length);
      } else {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }

      // Fetch settings for invoice generator
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, statusFilter, dateFilter.from, dateFilter.to]);

  useEffect(() => {
    const pageFromParams = Math.max(1, parseInt(searchParams.get('page') || '1'));
    if (pageFromParams !== currentPage) {
      setCurrentPage(pageFromParams);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredOrders = orders;

  const toggleSelectAll = () => {
    const filteredIds = filteredOrders.map(o => o._id);
    const areAllSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...prev, ...filteredIds.filter(id => !prev.includes(id))]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const updateStatus = async (id: string, status: string, extraData: any = {}) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extraData }),
      });

      if (res.ok) {
        toast.success(`Order updated successfully`);
        fetchOrders();
      } else {
        toast.error('Failed to update order');
      }
    } catch (error) {
      toast.error('Error updating order');
    }
  };

  const handleBulkUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Bulk Update?',
      text: `Are you sure you want to update ${selectedIds.length} orders to "${status}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#00D1B2',
      confirmButtonText: 'Yes, update them!',
    });

    if (!result.isConfirmed) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/admin/orders/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });

      if (res.ok) {
        toast.success(`Bulk update completed successfully`);
        setSelectedIds([]);
        fetchOrders();
      } else {
        toast.error('Bulk update failed');
      }
    } catch (error) {
      toast.error('Error in bulk update');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Bulk Delete?',
      text: `Are you sure you want to permanently delete ${selectedIds.length} orders? This cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete all!',
    });

    if (!result.isConfirmed) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/admin/orders/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (res.ok) {
        toast.success(`Orders deleted successfully`);
        setSelectedIds([]);
        fetchOrders();
      } else {
        toast.error('Bulk delete failed');
      }
    } catch (error) {
      toast.error('Error in bulk delete');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const exportToCSV = () => {
    const ordersToExport = selectedIds.length > 0
      ? orders.filter(o => selectedIds.includes(o._id))
      : filteredOrders;

    if (ordersToExport.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const headers = [
      'Order ID',
      'Date',
      'Customer',
      'Email',
      'Phone',
      'Address',
      'Division/State',
      'Items',
      'Shipping Charge',
      'Discount',
      'Total Amount',
      'Purchase Cost',
      'Profit',
      'Payment Status',
      'Order Status',
    ];

    const rows = ordersToExport.map((o: any) => {
      const shipping = o.shippingAddress || {};
      const fullAddress = `${shipping.street || ''}, ${shipping.city || ''}`;
      const itemsList = o.items.map((i: any) => {
        const variantDesc = [i.color, i.size].filter(Boolean).join('/');
        return `• ${i.quantity} x ${i.name}${variantDesc ? ` [${variantDesc}]` : ''} (@৳${i.price})`;
      }).join('\n');

      const totalPurchaseCost = o.items.reduce((acc: number, i: any) => acc + ((i.purchasePrice || 0) * i.quantity), 0);
      const profit = o.totalAmount - totalPurchaseCost - (o.deliveryCharge || 0);

      return [
        o._id.toUpperCase(),
        format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm'),
        shipping.fullName || o.user?.name || 'Guest',
        o.user?.email || 'Guest',
        shipping.phone || 'N/A',
        fullAddress,
        shipping.division || shipping.state || 'N/A',
        itemsList,
        o.deliveryCharge || 0,
        o.couponDiscountAmount || 0,
        o.totalAmount,
        totalPurchaseCost,
        Math.round(profit),
        o.paymentStatus,
        o.status,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Excel/CSV export started');
  };

  const deleteOrder = async (id: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This order will be permanently deleted from the database!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#00D1B2',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          toast.success('Order deleted successfully');
          fetchOrders();
        } else {
          toast.error('Failed to delete order');
        }
      } catch (error) {
        toast.error('Error deleting order');
      }
    }
  };

  const handleSendToSteadfast = async (ids: string[]) => {
    if (ids.length === 0) return;

    const result = await Swal.fire({
      title: 'Send to Steadfast?',
      text: `Are you sure you want to send ${ids.length} order(s) to Steadfast Courier?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Yes, send now!',
    });

    if (!result.isConfirmed) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/admin/courier/steadfast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids }),
      });

      const data = await res.json();
      if (res.ok) {
        const hasFailures = data.results && data.results.some((r: any) => !r.success);
        if (hasFailures) {
          const firstFail = data.results.find((r: any) => !r.success);
          toast.error(`${data.message}. Reason: ${firstFail?.message || 'Unknown error'}`);
        } else {
          toast.success(data.message);
        }
        if (ids.length > 1) setSelectedIds([]);
        fetchOrders();
      } else {
        toast.error(data.message || 'Submission failed');
      }
    } catch (error) {
      toast.error('Error sending to Steadfast');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const result = await Swal.fire({
      title: 'Cancel Order?',
      text: "Are you sure you want to cancel this order?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Yes, cancel it!',
    });

    if (result.isConfirmed) {
      await updateStatus(orderId, 'Cancelled');
    }
  };

  const openDetails = (id: string) => {
    setSelectedOrderId(id);
    setIsDetailsOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Order Placed': return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-none">Placed</Badge>;
      case 'Confirmed': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-none">Confirmed</Badge>;
      case 'Paid': return <Badge variant="secondary" className="bg-green-100 text-green-800 border-none text-[10px]">Paid</Badge>;
      case 'Ready for Delivery': return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-none text-[10px]">Ready</Badge>;
      case 'Released for Delivery': return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-none text-[10px]">Released</Badge>;
      case 'Delivered': return <Badge variant="default" className="bg-green-600 text-white border-none">Delivered</Badge>;
      case 'Cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 px-0 py-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap">Order Management</h2>
          <p className="text-muted-foreground text-xs md:text-sm hidden sm:block">Review, fulfillment and track shop orders.</p>
        </div>
        <Button onClick={exportToCSV} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shrink-0">
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      {/* Search and Date Range Row (1 Row) */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full">
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full h-10"
          />
        </div>

        <div className="block md:hidden w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 w-full">
                <FilterIcon className="mr-2 h-4 w-4" />
                {statusFilter === 'All' ? 'All Status' : statusFilter}
                <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  'All',
                  'Order Placed',
                  'Confirmed',
                  'Paid',
                  'Ready for Delivery',
                  'Released for Delivery',
                  'Delivered',
                  'Cancelled'
                ].map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={statusFilter === status ? "bg-accent font-bold" : ""}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{status}</span>
                      {status === 'All' && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          {totalCount}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border w-full md:w-auto h-10">
          <Input
            type="date"
            className="h-8 w-full md:w-36 border-none bg-transparent focus-visible:ring-0"
            value={dateFilter.from}
            onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            className="h-8 w-full md:w-36 border-none bg-transparent focus-visible:ring-0"
            value={dateFilter.to}
            onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
          />
        </div>

        {(statusFilter !== 'All' || dateFilter.from || dateFilter.to || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('All');
              setDateFilter({ from: '', to: '' });
              setSearchTerm('');
            }}
            className="text-xs text-muted-foreground hover:text-primary shrink-0"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Status Tabs Row (Desktop only - Full Width Grid) */}
      <div className="hidden md:grid md:grid-cols-8 gap-2 pb-2 border-b">
        {[
          { label: 'All', value: 'All' },
          { label: 'Placed', value: 'Order Placed' },
          { label: 'Confirmed', value: 'Confirmed' },
          { label: 'Paid', value: 'Paid' },
          { label: 'Ready', value: 'Ready for Delivery' },
          { label: 'Released', value: 'Released for Delivery' },
          { label: 'Delivered', value: 'Delivered' },
          { label: 'Cancelled', value: 'Cancelled' }
        ].map((status) => {
          const isActive = statusFilter === status.value;
          return (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`w-full py-2 text-xs font-semibold rounded-md transition-all duration-200 text-center truncate ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background hover:bg-muted text-muted-foreground border border-input'
              }`}
              title={status.label}
            >
              {status.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-md border bg-background overflow-hidden relative">
        {/* Bulk Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-0 z-20 w-full bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-4 text-sm font-medium">
              <span>{selectedIds.length} orders selected</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-white/10"
                onClick={() => setSelectedIds([])}
              >
                Deselect All
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white text-primary hover:bg-white/90"
                onClick={() => handlePrint(selectedIds)}
              >
                <Printer className="mr-2 h-3 w-3" /> Print Invoices
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-white text-primary hover:bg-white/90"
                onClick={() => handlePrintStickers(selectedIds)}
              >
                <Printer className="mr-2 h-3 w-3" /> Print Stickers
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-orange-500 text-white hover:bg-orange-600 border-none"
                onClick={() => handleSendToSteadfast(selectedIds)}
              >
                <Truck className="mr-2 h-3 w-3" /> Send to Steadfast
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-white text-primary hover:bg-white/90">
                    Update Status <ChevronDown className="ml-2 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Change Status to:</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkUpdate('Confirmed')}>Confirmed</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkUpdate('Paid')}>Paid</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkUpdate('Ready for Delivery')}>Ready for Delivery</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkUpdate('Released for Delivery')}>Released for Delivery</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkUpdate('Delivered')}>Delivered</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="destructive"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Order Info</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order._id} className={selectedIds.includes(order._id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(order._id)}
                      onCheckedChange={() => toggleSelect(order._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="flex flex-col cursor-pointer text-left hover:opacity-80 transition-opacity"
                        onClick={() => openDetails(order._id)}
                      >
                        <span className="font-bold text-primary hover:underline">#{order._id.slice(-8).toUpperCase()}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, p') : 'N/A'}
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {order.items?.map((item: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[9px] px-1 py-0 font-normal truncate max-w-[180px]">
                            {item.quantity}× {item.name}
                            {(item.color || item.size) && (
                              <span className="text-muted-foreground ml-1">
                                ({[item.color, item.size].filter(Boolean).join('/')})
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-semibold">{order.user?.name || 'Guest User'}</span>
                      <span className="text-muted-foreground truncate max-w-[150px]">{order.user?.email || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">৳{Math.round(order.totalAmount ?? 0)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        className={order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700 border-none font-bold' : 'bg-yellow-100 text-yellow-700 border-none font-bold'}
                      >
                        {order.paymentStatus}
                      </Badge>
                      {order.paymentMethod === 'Manual' && order.manualPaymentDetails && (
                        <div className="flex flex-col text-[10px] text-muted-foreground bg-slate-50 dark:bg-zinc-900 p-1.5 rounded border border-slate-100 dark:border-zinc-800 font-mono">
                          <span className="font-bold text-primary uppercase text-[9px]">{order.manualPaymentDetails.methodName}</span>
                          {order.manualPaymentDetails.senderNumber && (
                            <span>No: {order.manualPaymentDetails.senderNumber}</span>
                          )}
                          {order.manualPaymentDetails.transactionId && (
                            <span className="truncate max-w-[120px] font-bold text-slate-800 dark:text-zinc-200" title={order.manualPaymentDetails.transactionId}>
                              TrxID: {order.manualPaymentDetails.transactionId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {order.paymentMethod === 'Manual' && order.paymentStatus === 'Pending' && order.status !== 'Cancelled' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            title="Approve Manual Payment"
                            onClick={() => {
                              Swal.fire({
                                title: 'Approve Payment?',
                                text: `Are you sure you want to approve manual payment for order #${order._id.slice(-8).toUpperCase()}? This will mark the order as Confirmed & Paid.`,
                                icon: 'question',
                                showCancelButton: true,
                                confirmButtonColor: '#00D1B2',
                                confirmButtonText: 'Yes, Approve!'
                              }).then((result) => {
                                if (result.isConfirmed) {
                                  updateStatus(order._id, 'Confirmed', { paymentStatus: 'Paid' });
                                }
                              });
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Cancel Order"
                            onClick={() => handleCancelOrder(order._id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openDetails(order._id)}>
                        <Eye className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleDownloadInvoice(order)}>
                              <FileText className="mr-2 h-4 w-4 text-primary" /> Download Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrint([order._id])}>
                              <Printer className="mr-2 h-4 w-4 text-primary" /> Print Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintStickers([order._id])}>
                              <Printer className="mr-2 h-4 w-4 text-primary" /> Print Sticker Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendToSteadfast([order._id])} disabled={!!order.shippingDetails?.consignmentId}>
                              <Truck className="mr-2 h-4 w-4 text-orange-500" /> Send to Steadfast
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => updateStatus(order._id, 'Confirmed')}>Confirm</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(order._id, 'Paid', { paymentStatus: 'Paid' })}>Mark Paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(order._id, 'Ready for Delivery')}>Ready for Delivery</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(order._id, 'Released for Delivery')}>Release for Delivery</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(order._id, 'Delivered')}>Mark Delivered</DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleCancelOrder(order._id)}>Cancel Order</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive font-bold" onClick={() => deleteOrder(order._id)}>Delete Order</DropdownMenuItem>
                          </DropdownMenuGroup>
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
          <div className="py-6 border-t bg-white px-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', page.toString());
                router.push(`?${params.toString()}`);
              }}
            />
          </div>
        )}
      </div>

      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={fetchOrders}
      />

      {bulkActionLoading && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-bold">Processing bulk action...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
