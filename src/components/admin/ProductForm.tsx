/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useForm, useFieldArray, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Trash, 
  Loader2, 
  ArrowLeft,
  X,
  PlusCircle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ui/image-upload';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { 
  RadioGroup, 
  RadioGroupItem 
} from '@/components/ui/radio-group';
import { slugify } from '@/lib/slugify';

const NovelEditor = dynamic(() => import('@/components/editor/NovelEditor'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse bg-muted rounded-md" />
});

const productSchema = z.object({
  name: z.string().min(3, 'Name is required'),
  slug: z.string().min(3, 'Slug is required'),
  description: z.string().min(10, 'Description is required'),
  price: z.union([z.coerce.number().positive('Price must be greater than zero'), z.literal('')]),
  purchasePrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  discountRate: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional(),
  salePrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  sku: z.string().min(3, 'SKU is required'),
  stock: z.union([z.coerce.number().int().min(0, 'Stock must be at least 0'), z.literal('')]),
  categories: z.array(z.string()).min(1, 'Select at least one category'),
  images: z.array(z.string()).min(1, 'Upload at least one image'),
  isFeatured: z.boolean(),
  isNewArrival: z.boolean(),
  isFlashSale: z.boolean().optional(),
  isPublished: z.boolean(),
  attributes: z.array(z.object({
    key: z.string(),
    value: z.string()
  })),
  variants: z.array(z.object({
    color: z.string().optional(),
    size: z.string().optional(),
    price: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    purchasePrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    discountRate: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional(),
    salePrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    stock: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    sku: z.string().optional(),
    image: z.string().min(1, 'Variation image is required')
  })).default([]),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: any;
}

export function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Purchase Details optional section
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchasePriceDetail, setPurchasePriceDetail] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState('');

  const calculateDiscount = (price: number, salePrice?: number) => {
    if (!price || !salePrice || salePrice >= price) return 0;
    return Math.round((1 - salePrice / price) * 100);
  };

  const defaultValues: ProductFormValues = {
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    price: initialData?.price ?? '',
    purchasePrice: initialData?.purchasePrice ?? '',
    discountRate: calculateDiscount(initialData?.price, initialData?.salePrice) || '',
    salePrice: initialData?.salePrice ?? '',
    sku: initialData?.sku || '',
    stock: initialData?.stock ?? '',
    categories: initialData?.categories?.map((c: any) => typeof c === 'object' ? c._id : c) || [],
    images: initialData?.images || [],
    isPublished: initialData?.isPublished ?? true,
    isFeatured: initialData?.isFeatured ?? false,
    isNewArrival: initialData?.isNewArrival ?? false,
    isFlashSale: initialData?.isFlashSale ?? false,
    attributes: initialData?.attributes || [],
    variants: initialData?.variants?.map((v: any) => ({
      ...v,
      price: v.price ?? '',
      purchasePrice: v.purchasePrice ?? '',
      stock: v.stock ?? '',
      discountRate: calculateDiscount(v.price, v.salePrice) || '',
      salePrice: v.salePrice ?? '',
    })) || [],
  };

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes"
  });
  
  const { fields: variantFields, append: appendVariant, remove: removeVariant, replace: replaceVariants } = useFieldArray({
    control: form.control,
    name: "variants"
  });

  // Generation tool removed as variants are now managed directly

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([]);
        toast.error('Failed to load categories');
      }
    }
    async function fetchSuppliers() {
      try {
        const res = await fetch('/api/admin/suppliers');
        if (res.ok) {
          const data = await res.json();
          setSuppliers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    }
    fetchCategories();
    fetchSuppliers();
  }, []);

  const nameValue = form.watch('name');
  useEffect(() => {
    if (nameValue && !initialData) {
      form.setValue('slug', slugify(nameValue));
    }
  }, [nameValue, form, initialData]);

  const onSubmit = async (values: ProductFormValues) => {
    setLoading(true);
    // Clean up values: convert empty strings to undefined or numbers
    const cleanValues = {
      ...values,
      price: values.price === '' ? 0 : Number(values.price),
      purchasePrice: values.purchasePrice === '' ? undefined : Number(values.purchasePrice),
      salePrice: values.salePrice === '' ? undefined : Number(values.salePrice),
      discountRate: values.discountRate === '' || isNaN(Number(values.discountRate)) ? undefined : Number(values.discountRate),
      stock: values.stock === '' ? 0 : Number(values.stock),
      variants: (values.variants || []).map(v => ({
        ...v,
        price: v.price === '' ? 0 : Number(v.price),
        purchasePrice: v.purchasePrice === '' ? undefined : Number(v.purchasePrice),
        salePrice: v.salePrice === '' ? undefined : Number(v.salePrice),
        discountRate: v.discountRate === '' || isNaN(Number(v.discountRate)) ? undefined : Number(v.discountRate),
        stock: v.stock === '' ? 0 : Number(v.stock),
      }))
    };

    try {
      const url = initialData ? `/api/products/${initialData._id}` : '/api/products';
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanValues),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Something went wrong');
        setLoading(false);
        return;
      }

      const savedProduct = await response.json();

      // If purchase details are filled in, create a supplier bill entry
      if (showPurchaseDetails && purchaseSupplierId && purchasePriceDetail) {
        try {
          const qty = parseInt(purchaseQty) || 1;
          const price = parseFloat(purchasePriceDetail) || 0;
          const paid = parseFloat(purchasePaidAmount) || 0;
          const total = qty * price;

          await fetch('/api/admin/supplier-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: purchaseSupplierId,
              date: purchaseDate || undefined,
              items: [{ name: values.name, quantity: qty, price }],
              subtotal: total,
              discount: 0,
              total,
              paidAmount: paid,
              paymentMethod: purchasePaymentMethod,
              customBillNo: purchaseInvoiceNo || undefined,
            }),
          });
        } catch (purchaseErr) {
          console.error('Purchase details save error:', purchaseErr);
          // Non-fatal: product already saved, just warn
          toast.error('Product saved but purchase details could not be recorded.');
        }
      }

      toast.success(`Product ${initialData ? 'updated' : 'created'} successfully`);
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const addImage = (url: string) => {
    const currentImages = form.getValues('images');
    form.setValue('images', [...currentImages, url], {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const removeImage = (url: string) => {
    const currentImages = form.getValues('images');
    form.setValue('images', currentImages.filter(i => i !== url), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const toggleCategory = (catId: string) => {
    const currentCats = form.getValues('categories');
    const category = categories.find(c => c._id === catId);
    if (!category) return;

    if (currentCats.includes(catId)) {
      // Removing category
      let newCats = currentCats.filter(id => id !== catId);
      
      // If it's a main category (no parent), also remove its subcategories
      if (!category.parentCategory) {
        newCats = newCats.filter(id => {
          const sub = categories.find(c => c._id === id);
          const parentId = sub?.parentCategory?._id || sub?.parentCategory;
          return parentId !== catId;
        });
      }

      form.setValue('categories', newCats, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      // Adding category
      form.setValue('categories', [...currentCats, catId], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const selectedCats = form.watch('categories');
  const mainCategories = categories.filter((cat) => !cat.parentCategory);
  const selectedMainCategoryIds = mainCategories
    .filter(mc => selectedCats.includes(mc._id))
    .map(mc => mc._id);

  // Validation Check: ensure at least one main category is selected
  const hasMainCategory = selectedMainCategoryIds.length > 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {initialData ? 'Edit' : 'Add'} Product
            </h1>
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Product
          </Button>
        </div>

        <div className="max-w-5xl mx-auto w-full space-y-6">
          {/* Product Information */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="product-slug" 
                            {...field} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const sanitized = val
                                .replace(/\s+/g, '-')
                                .replace(/[^a-zA-Z0-9-]/g, '')
                                .replace(/-+/g, '-')
                                .toLowerCase();
                              field.onChange(sanitized);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input placeholder="STK-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <div className="min-h-[300px] border rounded-md overflow-hidden bg-background prose-sm max-w-none">
                          <NovelEditor 
                            initialValue={(() => {
                              try {
                                return field.value ? JSON.parse(field.value) : undefined;
                              } catch (e) {
                                // Fallback for plain text description
                                return {
                                  type: 'doc',
                                  content: [{ type: 'paragraph', content: [{ type: 'text', text: field.value }] }]
                                };
                              }
                            })()} 
                            onChange={field.onChange} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Gallery Images</Label>
                </div>

              {/* Image Upload Best Practice Guideline */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>Image Upload Guidelines (For Best Quality & Zoom)</span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-1 list-disc list-inside text-[11px] leading-relaxed">
                  <li><strong>Max Size:</strong> Maximum file size is <strong>1 MB</strong> per image.</li>
                  <li><strong>Ratio:</strong> 1:1 square or 3:4 portrait ratio is recommended.</li>
                  <li><strong>Clean Background:</strong> Use bright lighting with neutral/light background for true colors.</li>
                </ul>
                <div className="flex items-center gap-1.5 text-destructive font-semibold text-[11px] bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1.5 mt-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] bg-destructive text-white px-1.5 py-0.5 rounded">Max 1 MB • WebP</span>
                  <span>Upload in <strong>.webp</strong> format (Max 1 MB) to ensure 100% original sharpness, zero quality loss, and instant loading!</span>
                </div>
              </div>
                <div className="grid grid-cols-4 gap-4">
                  {form.watch('images').map((url, index) => (
                    <div key={`${url}-${index}`} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                      <Image 
                        src={url} 
                        alt={`Product image ${index + 1}`} 
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        className="object-cover" 
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 z-10"
                        aria-label={`Remove product image ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <ImageUpload onUpload={addImage} compact />
                </div>
                {form.formState.errors.images?.message && (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.images.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Attributes (Size, Color, etc.)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ key: '', value: '' })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Attribute
                  </Button>
                </div>
                <div className="space-y-4">
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex gap-4 items-end">
                      <div className="flex-1">
                        <Label>Label</Label>
                        <Input {...form.register(`attributes.${index}.key` as const)} placeholder="e.g. Material" />
                      </div>
                      <div className="flex-1">
                        <Label>Value</Label>
                        <Input {...form.register(`attributes.${index}.value` as const)} placeholder="e.g. Cotton" />
                      </div>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive" 
                        onClick={() => remove(index)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <PlusCircle className="h-5 w-5" /> 
                    Variation Manager
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage stock, price, and images for every variation.</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="bg-background hover:bg-primary hover:text-white transition-all border-primary/20"
                  onClick={() => appendVariant({ color: '', size: '', price: form.getValues('price') || '', stock: '', sku: '', image: '' })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add New Variation
                </Button>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b text-muted-foreground font-medium">
                          <th className="px-4 py-3 text-left w-[120px]">Image</th>
                          <th className="px-4 py-3 text-left">Color</th>
                          <th className="px-4 py-3 text-left">Size</th>
                          <th className="px-4 py-3 text-left w-[100px]">Price</th>
                          <th className="px-4 py-3 text-left w-[100px]">Purchase</th>
                          <th className="px-4 py-3 text-left w-[80px]">Disc (%)</th>
                          <th className="px-4 py-3 text-left w-[100px]">Sale</th>
                          <th className="px-4 py-3 text-left w-[80px]">Stock</th>
                          <th className="px-4 py-3 text-left">SKU</th>
                          <th className="px-4 py-3 text-center w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {variantFields.map((field, index) => (
                          <tr key={field.id} className="hover:bg-muted/20 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="relative h-14 w-14 rounded-lg overflow-hidden border bg-background flex items-center justify-center group/img">
                                {form.watch(`variants.${index}.image`) ? (
                                  <>
                                    <Image 
                                      src={form.watch(`variants.${index}.image`) || ''} 
                                      alt="" 
                                      fill 
                                      className="object-cover" 
                                    />
                                    <button
                                      type="button"
                                      onClick={() => form.setValue(`variants.${index}.image`, '')}
                                      className="absolute top-0.5 right-0.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : (
                                  <ImageUpload 
                                    onUpload={(url) => form.setValue(`variants.${index}.image`, url)} 
                                    className="p-0 border-none h-full w-full rounded-none"
                                    iconClassName="h-4 w-4"
                                    compact
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                {...form.register(`variants.${index}.color` as const)} 
                                placeholder="Yellow" 
                                className="h-9 border-muted-foreground/20 focus:border-primary transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                {...form.register(`variants.${index}.size` as const)} 
                                placeholder="XL" 
                                className="h-9 border-muted-foreground/20 focus:border-primary transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                type="number" 
                                value={form.watch(`variants.${index}.price`) ?? ''}
                                className="h-9 border-muted-foreground/20"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                  form.setValue(`variants.${index}.price`, val);
                                  const disc = form.getValues(`variants.${index}.discountRate`) || 0;
                                  if (disc > 0 && val !== '') {
                                      form.setValue(`variants.${index}.salePrice`, Math.round(val * (1 - disc / 100)));
                                  }
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                type="number" 
                                value={form.watch(`variants.${index}.purchasePrice`) ?? ''}
                                className="h-9 border-muted-foreground/20"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                  form.setValue(`variants.${index}.purchasePrice`, val);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                                <Input 
                                    type="number" 
                                    value={form.watch(`variants.${index}.discountRate`) ?? ''}
                                    placeholder="0"
                                    className="h-9 border-muted-foreground/20"
                                    onChange={(e) => {
                                        const disc = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                                        form.setValue(`variants.${index}.discountRate`, disc);
                                        const prc = form.getValues(`variants.${index}.price`) || 0;
                                        if (prc > 0 && disc !== undefined) {
                                            form.setValue(`variants.${index}.salePrice`, Math.round(prc * (1 - disc / 100)));
                                        } else {
                                            form.setValue(`variants.${index}.salePrice`, undefined);
                                        }
                                    }}
                                />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                type="number" 
                                value={form.watch(`variants.${index}.salePrice`) ?? ''}
                                placeholder="Optional"
                                className="h-9 border-muted-foreground/20"
                                onChange={(e) => {
                                    const sale = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                                    form.setValue(`variants.${index}.salePrice`, sale);
                                    const prc = form.getValues(`variants.${index}.price`) || 0;
                                    if (prc > 0 && sale !== undefined && sale > 0 && sale < prc) {
                                        form.setValue(`variants.${index}.discountRate`, Math.round((1 - sale / prc) * 100));
                                    } else {
                                        form.setValue(`variants.${index}.discountRate`, undefined);
                                    }
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                type="number" 
                                value={form.watch(`variants.${index}.stock`) ?? ''}
                                className="h-9 border-muted-foreground/20"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : (parseInt(e.target.value) || 0);
                                  form.setValue(`variants.${index}.stock`, val);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                {...form.register(`variants.${index}.sku` as const)} 
                                placeholder="SKU"
                                className="h-9 border-muted-foreground/20"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => removeVariant(index)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regular Price (Tk)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                              field.onChange(value);
                              // Sync sale price if discount exists
                              const prc = value === '' ? 0 : value;
                              const discount = form.getValues('discountRate') || 0;
                              if (discount > 0 && prc > 0) {
                                const newSale = prc * (1 - discount / 100);
                                form.setValue('salePrice', Math.round(newSale));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price (Tk)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discountRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0"
                            {...field} 
                            value={field.value || ''}
                            onChange={(e) => {
                              const discount = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                              field.onChange(discount);
                              const price = form.getValues('price') || 0;
                              if (price > 0 && discount !== undefined) {
                                const newSale = price * (1 - discount / 100);
                                form.setValue('salePrice', Math.round(newSale));
                              } else {
                                form.setValue('salePrice', undefined);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price (Tk)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            {...field} 
                            value={field.value || ''}
                            onChange={(e) => {
                              const sale = parseFloat(e.target.value) || 0;
                              field.onChange(sale);
                              const price = form.getValues('price') || 0;
                              if (price > 0 && sale > 0 && sale < price) {
                                const newDiscount = Math.round((1 - sale / price) * 100);
                                form.setValue('discountRate', newDiscount);
                              } else {
                                form.setValue('discountRate', undefined);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="mt-6">
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Stock Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                          />
                        </FormControl>
                        <FormDescription>Physical stock available for sale</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Product Category</Label>
                  <span className="text-[10px] text-destructive uppercase font-bold">Required</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {mainCategories.map((mainCat) => (
                    <Badge
                      key={mainCat._id}
                      variant={selectedCats.includes(mainCat._id) ? 'default' : 'outline'}
                      className="cursor-pointer py-1.5 px-4 text-sm"
                      onClick={() => toggleCategory(mainCat._id)}
                    >
                      {mainCat.name}
                    </Badge>
                  ))}
                </div>
                {!hasMainCategory && form.formState.isSubmitted && (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    Select at least one product category
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Sub Category</Label>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Optional</span>
                </div>
                <div className="space-y-4 pt-2">
                  {selectedMainCategoryIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {categories
                        .filter((sub) => {
                          const parentId = sub.parentCategory?._id || sub.parentCategory;
                          return selectedMainCategoryIds.includes(parentId);
                        })
                        .map((subCat) => (
                          <Badge
                            key={subCat._id}
                            variant={selectedCats.includes(subCat._id) ? 'default' : 'outline'}
                            className="cursor-pointer py-1 px-3 text-xs"
                            onClick={() => toggleCategory(subCat._id)}
                          >
                            {subCat.name}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Select a product category to see available subcategories
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="featured">Featured Product</Label>
                    <input 
                        type="checkbox" 
                        id="featured"
                        {...form.register('isFeatured')} 
                        className="h-4 w-4 accent-primary cursor-pointer hover:scale-110 transition-transform" 
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="new-arrival">New Arrival</Label>
                    <input 
                        type="checkbox" 
                        id="new-arrival"
                        {...form.register('isNewArrival')} 
                        className="h-4 w-4 accent-primary cursor-pointer hover:scale-110 transition-transform" 
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="flash-sale">Flash Sale</Label>
                    <input 
                        type="checkbox" 
                        id="flash-sale"
                        {...form.register('isFlashSale')} 
                        className="h-4 w-4 accent-primary cursor-pointer hover:scale-110 transition-transform" 
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="published">Published</Label>
                    <input 
                        type="checkbox" 
                        id="published"
                        {...form.register('isPublished')} 
                        className="h-4 w-4" 
                    />
                </div>
              </CardContent>
            </Card>

            {/* Optional Purchase Details Section */}
            <Card className="border-2 border-dashed border-amber-300 bg-amber-50/30">
              <CardContent className="pt-5">
                {/* Toggle header */}
                <button
                  type="button"
                  onClick={() => setShowPurchaseDetails(!showPurchaseDetails)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 group-hover:bg-amber-200 transition-colors">
                      <ShoppingCart className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-amber-900">Add Purchase Details</p>
                      <p className="text-xs text-amber-600">Supplier name, purchase price, invoice no. — Optional</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-amber-600 border border-amber-300 rounded px-1.5 py-0.5">
                      Optional
                    </span>
                    {showPurchaseDetails
                      ? <ChevronUp className="h-4 w-4 text-amber-700" />
                      : <ChevronDown className="h-4 w-4 text-amber-700" />
                    }
                  </div>
                </button>

                {/* Collapsible form body */}
                {showPurchaseDetails && (
                  <div className="mt-5 space-y-4 border-t border-amber-200 pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Supplier */}
                      <div>
                        <Label htmlFor="pd-supplier" className="text-sm font-medium">
                          Supplier / Vendor
                        </Label>
                        <select
                          id="pd-supplier"
                          value={purchaseSupplierId}
                          onChange={(e) => setPurchaseSupplierId(e.target.value)}
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">— Select Supplier —</option>
                          {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name}{s.companyName ? ` (${s.companyName})` : ''}
                            </option>
                          ))}
                        </select>
                        {suppliers.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            No suppliers found.{' '}
                            <a href="/admin/suppliers" target="_blank" className="text-primary underline">Add a supplier</a> first.
                          </p>
                        )}
                      </div>

                      {/* Purchase Price */}
                      <div>
                        <Label htmlFor="pd-price" className="text-sm font-medium">
                          Purchase Price (per unit, BDT)
                        </Label>
                        <Input
                          id="pd-price"
                          type="number"
                          placeholder="0.00"
                          value={purchasePriceDetail}
                          onChange={(e) => setPurchasePriceDetail(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Purchase Date */}
                      <div>
                        <Label htmlFor="pd-date" className="text-sm font-medium">
                          Purchase Date
                        </Label>
                        <Input
                          id="pd-date"
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Invoice / Bill Number */}
                      <div>
                        <Label htmlFor="pd-invoice" className="text-sm font-medium">
                          Supplier Invoice No.
                        </Label>
                        <Input
                          id="pd-invoice"
                          type="text"
                          placeholder="e.g. INV-2024-001 (optional)"
                          value={purchaseInvoiceNo}
                          onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Quantity Purchased */}
                      <div>
                        <Label htmlFor="pd-qty" className="text-sm font-medium">
                          Quantity Purchased
                        </Label>
                        <Input
                          id="pd-qty"
                          type="number"
                          placeholder="1"
                          min="1"
                          value={purchaseQty}
                          onChange={(e) => setPurchaseQty(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Payment Method */}
                      <div>
                        <Label htmlFor="pd-method" className="text-sm font-medium">
                          Payment Method
                        </Label>
                        <select
                          id="pd-method"
                          value={purchasePaymentMethod}
                          onChange={(e: any) => setPurchasePaymentMethod(e.target.value)}
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank">Bank</option>
                        </select>
                      </div>

                      {/* Paid Amount */}
                      <div>
                        <Label htmlFor="pd-paid" className="text-sm font-medium">
                          Amount Paid Upfront (BDT)
                        </Label>
                        <Input
                          id="pd-paid"
                          type="number"
                          placeholder="0 (leave blank if full due)"
                          value={purchasePaidAmount}
                          onChange={(e) => setPurchasePaidAmount(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-2">
                        <Label htmlFor="pd-notes" className="text-sm font-medium">
                          Notes (Optional)
                        </Label>
                        <Input
                          id="pd-notes"
                          type="text"
                          placeholder="e.g. Received in 2 batches, warehouse A"
                          value={purchaseNotes}
                          onChange={(e) => setPurchaseNotes(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    {/* Summary preview */}
                    {purchaseSupplierId && purchasePriceDetail && (
                      <div className="bg-amber-100/60 border border-amber-200 rounded-md p-3 text-xs space-y-1 text-amber-900">
                        <p className="font-semibold text-sm mb-1">Purchase Summary Preview</p>
                        <div className="flex justify-between">
                          <span>Qty × Unit Price:</span>
                          <span className="font-medium">
                            {purchaseQty || 1} × ৳{parseFloat(purchasePriceDetail || '0').toLocaleString()} = ৳{((parseInt(purchaseQty) || 1) * (parseFloat(purchasePriceDetail) || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Paid Now:</span>
                          <span className="font-medium text-emerald-700">৳{parseFloat(purchasePaidAmount || '0').toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-amber-300 pt-1">
                          <span>Due to Supplier:</span>
                          <span className="font-bold text-rose-700">
                            ৳{Math.max(0, ((parseInt(purchaseQty) || 1) * (parseFloat(purchasePriceDetail) || 0)) - (parseFloat(purchasePaidAmount) || 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
    </Form>
  );
}

