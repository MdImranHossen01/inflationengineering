'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail, Phone, MapPin, CreditCard, Calendar, Truck, ExternalLink, FileText, Printer } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/lib/invoice-generator';
import { printStickerInvoice } from '@/lib/sticker-generator';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function OrderDetailsDialog({
  orderId,
  open,
  onOpenChange,
  onUpdate,
}: OrderDetailsDialogProps) {
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const handleLocalPrint = async (type: 'invoice' | 'sticker') => {
    if (type === 'invoice') {
      toast.info('Generating PDF invoice...');
      await generateInvoicePDF(order, settings, 'print');
    } else {
      toast.info('Preparing sticker invoice...');
      await printStickerInvoice(order, settings);
    }
  };

  // Additional Shipping Fields
  const [cityId, setCityId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [shippingNote, setShippingNote] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [orderRes, settingsRes] = await Promise.all([
            fetch(`/api/orders/${orderId}`, { signal: controller.signal }),
            fetch(`/api/settings`, { signal: controller.signal })
        ]);

        if (!orderRes.ok) {
          const errData = await orderRes.json().catch(() => ({}));
          toast.error(errData.message || `Failed to load order: ${orderRes.statusText || orderRes.status}`);
          return;
        }

        if (!settingsRes.ok) {
          const errData = await settingsRes.json().catch(() => ({}));
          toast.error(errData.message || `Failed to load settings: ${settingsRes.statusText || settingsRes.status}`);
          return;
        }

        const [orderData, settingsData] = await Promise.all([
          orderRes.json(),
          settingsRes.json()
        ]);
        
        setOrder(orderData);
        setSettings(settingsData);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
          toast.error('Error loading data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (open && orderId) {
      fetchData();
    } else {
      setOrder(null);
      setSettings(null);
      // Reset shipping fields when closing or switching orders
      setCityId('');
      setZoneId('');
      setAreaId('');
      setShippingNote('');
    }

    return () => controller.abort();
  }, [open, orderId]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-bold">
              Order Details
            </DialogTitle>
            {order && (
               <div className="flex items-center gap-2">
                  <Badge variant={order.status === 'Delivered' ? 'default' : 'secondary'}>
                    {order.status}
                  </Badge>
                  <button 
                    onClick={() => handleLocalPrint('invoice')}
                    className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Print A4 Invoice"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleLocalPrint('sticker')}
                    className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 px-2.5 py-1"
                    title="Print Sticker Invoice"
                  >
                    <Printer className="h-4 w-4" />
                    <span className="text-[10px] font-bold">Sticker</span>
                  </button>
               </div>
            )}
          </div>
          <DialogDescription>
            {order ? `Order ID: #${String(order._id ?? '').toUpperCase()}` : 'Loading order details...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : order ? (
          <div className="space-y-6 pt-4">
            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-muted-foreground">Customer</h3>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {order.user?.name?.[0] || 'G'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.user?.name || 'Guest User'}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {order.user?.email || 'No Email'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-muted-foreground">Order Date</h3>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {order.createdAt && isValid(new Date(order.createdAt)) 
                      ? format(new Date(order.createdAt), 'MMMM dd, yyyy p')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Shipping & Payment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Shipping Address
                </h4>
                <div className="text-sm leading-relaxed">
                  {(order.shippingAddress?.fullName || order.user?.name) && (
                    <p>{order.shippingAddress?.fullName || order.user?.name}</p>
                  )}
                  {order.shippingAddress?.street && <p>{order.shippingAddress?.street}</p>}
                  {(order.shippingAddress?.city || order.shippingAddress?.state || order.shippingAddress?.zipCode) && (
                    <p>
                      {[order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ')}
                      {([order.shippingAddress?.city, order.shippingAddress?.state].some(Boolean) && order.shippingAddress?.zipCode) ? ' ' : ''}
                      {order.shippingAddress?.zipCode}
                    </p>
                  )}
                  {order.shippingAddress?.country && <p>{order.shippingAddress?.country}</p>}
                  {order.shippingAddress?.phone && (
                    <p className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <Phone className="h-3 w-3" /> {order.shippingAddress.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payment Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>Method:</span>
                    <span>{order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Status:</span>
                    <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'outline'} className={order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : ''}>
                      {order.paymentStatus}
                    </Badge>
                  </div>
                  {order.transactionId && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Transaction ID:</span>
                      <code className="bg-muted px-2 py-1 rounded text-[10px] break-all">{order.transactionId}</code>
                    </div>
                  )}

                  {order.paymentMethod === 'Manual' && order.manualPaymentDetails && (
                    <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                       <p className="text-[10px] font-black uppercase text-primary tracking-widest">Manual Verification</p>
                       <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                             <span className="text-muted-foreground block">Method:</span>
                             <span className="font-bold uppercase">{order.manualPaymentDetails.methodName}</span>
                          </div>
                          <div>
                             <span className="text-muted-foreground block">Sender No:</span>
                             <span className="font-bold">{order.manualPaymentDetails.senderNumber}</span>
                          </div>
                          <div className="col-span-2">
                             <span className="text-muted-foreground block">TrxID:</span>
                             <code className="font-bold text-primary bg-white px-1.5 py-0.5 rounded border">{order.manualPaymentDetails.transactionId}</code>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Shipping Management (Admin Action) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center justify-between">
                <span>Shipping Management</span>
              </h3>
              
              {order.shippingDetails?.trackingId ? (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground">Courier Service</p>
                      <p className="font-bold text-sm">{order.shippingDetails.courierName}</p>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      {order.shippingDetails.courierStatus || 'Processing'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Tracking ID</p>
                      <code className="text-sm font-mono font-bold">{order.shippingDetails.trackingId}</code>
                    </div>
                    {order.shippingDetails.trackingUrl && (
                      <a 
                        href={order.shippingDetails.trackingUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        Track Status <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {settings?.courierConfig?.activeProvider === 'none' ? (
                    <div className="text-xs bg-yellow-50 text-yellow-700 p-3 rounded-lg border border-yellow-200">
                      <strong>Note:</strong> Courier integration is not configured. Please go to Settings &gt; Courier to enable automated booking.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase">Booking Details ({settings?.courierConfig?.activeProvider})</span>
                        </div>
                        
                        {(settings?.courierConfig?.activeProvider === 'pathao' || settings?.courierConfig?.activeProvider === 'redx') && (
                            <div className="grid grid-cols-2 gap-2">
                                {settings?.courierConfig?.activeProvider === 'pathao' && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold">City ID</label>
                                            <input type="text" value={cityId} onChange={(e) => setCityId(e.target.value)} placeholder="e.g. 1" className="w-full text-xs p-2 border rounded" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold">Zone ID</label>
                                            <input type="text" value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="e.g. 1" className="w-full text-xs p-2 border rounded" />
                                        </div>
                                    </>
                                )}
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold">Area ID</label>
                                    <input type="text" value={areaId} onChange={(e) => setAreaId(e.target.value)} placeholder="e.g. 123" className="w-full text-xs p-2 border rounded" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold">Shipping Note</label>
                            <input type="text" value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} placeholder="Package handle with care..." className="w-full text-xs p-2 border rounded" />
                        </div>
                      </div>

                      <button
                        disabled={bookingLoading}
                        onClick={async () => {
                          const isActiveSteadfast = settings?.courierConfig?.activeProvider === 'steadfast';
                          const endpoint = isActiveSteadfast 
                            ? '/api/admin/courier/steadfast' 
                            : `/api/admin/orders/${order._id}/book-courier`;
                          const payload = isActiveSteadfast 
                            ? { orderIds: [order._id] } 
                            : { city_id: cityId, zone_id: zoneId, area_id: areaId, note: shippingNote };

                          const result = await Swal.fire({
                            title: isActiveSteadfast ? 'Send to Steadfast?' : 'Book Courier?',
                            text: isActiveSteadfast 
                              ? `Are you sure you want to send 1 order(s) to Steadfast Courier?`
                              : `Hand over order #${order._id} to ${settings?.courierConfig?.activeProvider}?`,
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonColor: '#2563eb',
                            confirmButtonText: 'Yes, send now!'
                          });
                          
                          if (!result.isConfirmed) return;
                          
                          setBookingLoading(true);
                          try {
                            const res = await fetch(endpoint, { 
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            
                                                         const data = await res.json();
                             if (res.ok) {
                               const hasFailures = data.results && data.results.some((r: any) => !r.success);
                               if (hasFailures) {
                                 const firstFail = data.results.find((r: any) => !r.success);
                                 toast.error(`${data.message}. Reason: ${firstFail?.message || 'Unknown error'}`);
                               } else {
                                 toast.success(data.message || `${settings?.courierConfig?.activeProvider} booked successfully!`);
                               }
                               onUpdate();
                               const updateRes = await fetch(`/api/orders/${orderId}`);
                               if (updateRes.ok) setOrder(await updateRes.json());
                             } else {
                              toast.error(data.message || 'Courier booking failed');
                            }
                          } catch (e) {
                            toast.error('Network error');
                          } finally {
                            setBookingLoading(false);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} 
                        Hand over to {settings?.courierConfig?.activeProvider ? settings.courierConfig.activeProvider.toUpperCase() : 'Courier'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <Separator />
            
            {/* Items */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase text-muted-foreground">Order Items</h4>
              <div className="space-y-3">
                {(order.items || []).map((item: any, i: number) => (
                  <div key={item._id || item.id || i} className="flex items-center justify-between text-sm gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-12 w-12 rounded border overflow-hidden bg-muted flex-shrink-0">
                         {item.image ? (
                             <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                         ) : (
                             <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                         )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium line-clamp-1">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.color && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-muted/50">{item.color}</Badge>}
                          {item.size && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-muted/50">Size: {item.size}</Badge>}
                          <span className="text-xs text-muted-foreground ml-1">৳{Math.round(Number(item.price) || 0)} × {item.quantity}</span>
                        </div>
                      </div>
                    </div>
                    <div className="font-bold">
                      ৳{Math.round(Number(item.price || 0) * (item.quantity || 0))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t flex justify-between items-center text-lg">
                <span className="font-bold">Total Amount:</span>
                <span className="font-black text-primary">৳{Math.round(Number(order.totalAmount) || 0)}</span>
              </div>
            </div>

            {/* Quick Actions for Manual Payments */}
            {order.paymentMethod === 'Manual' && order.paymentStatus === 'Pending' && order.status !== 'Cancelled' && (
              <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={async () => {
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
                      try {
                        const res = await fetch(`/api/orders/${order._id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'Cancelled' }),
                        });
                        if (res.ok) {
                          toast.success('Order cancelled successfully');
                          onUpdate();
                          onOpenChange(false);
                        } else {
                          toast.error('Failed to update order');
                        }
                      } catch (e) {
                        toast.error('Error updating order');
                      }
                    }
                  }}
                  className="rounded-xl h-11 flex-1 font-bold text-destructive hover:bg-destructive/5"
                >
                  Reject & Cancel Order
                </Button>
                <Button 
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: 'Approve Payment & Order?',
                      text: `Confirm manual payment and mark order #${order._id.slice(-8).toUpperCase()} as Confirmed & Paid?`,
                      icon: 'question',
                      showCancelButton: true,
                      confirmButtonColor: '#00D1B2',
                      confirmButtonText: 'Yes, Approve!'
                    });
                    if (result.isConfirmed) {
                      try {
                        const res = await fetch(`/api/orders/${order._id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Paid' }),
                        });
                        if (res.ok) {
                          toast.success('Order approved successfully');
                          onUpdate();
                          onOpenChange(false);
                        } else {
                          toast.error('Failed to approve order');
                        }
                      } catch (e) {
                        toast.error('Error approving order');
                      }
                    }
                  }}
                  className="rounded-xl h-11 flex-1 font-black uppercase tracking-wider text-xs shadow-md shadow-primary/10"
                >
                  Approve Manual Payment
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            No details found for this order.
          </div>
        )}
      </DialogContent>

    </Dialog>
  );
}

