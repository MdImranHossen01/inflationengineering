/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, User, Menu, X, Heart, LayoutDashboard, Settings, LogOut, MapPin, Phone, HelpCircle, Truck, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppSelector } from '@/store/hooks';
import { useSession, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { CartDrawer } from '@/components/layout/CartDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { MobileNavbar } from '@/components/layout/MobileNavbar';
import { useEffect } from 'react';

export default function NavbarV4() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const cartItemsCount = useAppSelector((state) => state.cart.items.reduce((total, item) => total + item.quantity, 0));
  const wishlistCount = useAppSelector((state) => state.wishlist.items.length);
  const totalAmount = useAppSelector((state) => state.cart.items.reduce((total, item) => total + (item.price * item.quantity), 0));

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.filter((c: any) => c.isActive && !c.parentCategory)))
      .catch(err => console.error('Failed to fetch categories', err));
  }, []);

  useEffect(() => {
    if (session) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => setProfile(data))
        .catch(err => console.error('Failed to fetch profile', err));
    } else {
      setProfile(null);
    }
  }, [session]);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const NAV_LINKS = [
    { label: 'Marketplace', href: '/shop' },
    { label: 'Daily Deals', href: '/shop?filter=deals' },
    { label: 'New Arrival', href: '/shop?sort=newest' },
    { label: 'Community', href: '/blog' }
  ];

  return (
    <>
      {/* ── Mobile Top Bar (V1 Standard) — lg:hidden ──────────────── */}
      <MobileNavbar navItems={NAV_LINKS} categories={categories} />

      {/* ── Desktop Navbar ─────────────────────────────────────────── */}
      <nav className="hidden lg:block bg-[#0f1111] text-white border-b border-white/5 relative shadow-2xl">
        {/* Utility Top Bar */}
        <div className="bg-[#1a1c1c] text-neutral-400 py-2 border-b border-white/5">
          <div className="container mx-auto px-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
            <div className="flex items-center gap-8">
              <Link href="/shop" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Delivery: Global"><MapPin className="h-3 w-3 text-primary" /> Delivery: Global</Link>
              <Link href="/contact" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Support Core"><Phone className="h-3 w-3 text-primary" /> Support Core</Link>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/help" className="hover:text-white flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Assistance</Link>
              <span className="text-white/20">|</span>
              <Link href="/track-order" className="hover:text-white">Track Order</Link>
            </div>
          </div>
        </div>

        {/* Main Header Architecture */}
        <div className="container mx-auto px-4 py-5 flex items-center gap-6 lg:gap-12">
          {/* Mobile Menu Trigger */}
          <div className="lg:hidden">
            <MobileMenu navItems={NAV_LINKS} categories={categories} session={session} />
          </div>

          {/* Branding */}
          <Link href="/" className="text-2xl md:text-3xl font-black text-white shrink-0 tracking-tighter flex items-center gap-1">
            Inflation Engineering<span className="text-primary italic">SHOP</span>
          </Link>

          {/* Professional Search System */}
          <form onSubmit={handleSearch} className="hidden lg:flex flex-1 relative group">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-white/10 bg-white/5 pr-24 text-white placeholder:text-neutral-500 focus-visible:ring-offset-0 focus-visible:ring-primary focus-visible:bg-white/10 focus-visible:border-primary transition-all"
              placeholder="Search professional catalog..."
            />
            <Button
              type="submit"
              className="absolute right-1 top-1 bottom-1 bg-primary text-white hover:bg-white hover:text-black px-6 font-black text-xs uppercase rounded-lg transition-all"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {/* User & Global Cart Actions */}
          <div className="flex items-center gap-4 md:gap-8 ml-auto lg:ml-0">
            <Link
              href="/dashboard/wishlist"
              aria-label="Wishlist"
              className="relative group hidden sm:flex items-center gap-3 hover:scale-110 transition-all"
              onClick={(e) => {
                if (status !== 'authenticated') {
                  e.preventDefault();
                  toast.error('Please login to view your wishlist');
                }
              }}
            >
              <div className="h-11 w-11 rounded-xl bg-transparent flex items-center justify-center transition-all border-none">
                <Heart className={`h-5 w-5 ${wishlistCount > 0 ? 'fill-primary text-primary' : 'text-white'} group-hover:text-primary transition-colors`} />
              </div>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#0f1111] animate-in zoom-in">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 group cursor-pointer outline-none hover:scale-110 transition-all">
                    <div className="h-11 w-11 rounded-xl border-2 border-white/10 overflow-hidden group-hover:border-primary transition-all relative">
                      <Image
                        src={session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || '')}`}
                        alt={session.user?.name || 'User'}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="hidden xl:flex flex-col text-left transition-colors group-hover:text-primary">
                      <span className="text-[9px] opacity-40 uppercase font-black tracking-widest leading-none mb-1">Authenticated</span>
                      <span className="text-xs font-bold leading-none truncate max-w-[100px]">{session.user?.name?.split(' ')[0]}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-serif">
                      <div className="flex flex-col text-foreground">
                        <span>{session.user?.name}</span>
                        <span className="text-xs font-normal text-muted-foreground truncate">{session.user?.email}</span>
                        {profile && (
                          <div className="mt-1.5 flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full w-fit border border-primary/20">
                            <Package className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary">৳{profile.walletBalance || 0} Tokens</span>
                          </div>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Role Based Navigation */}
                    {(session.user as any)?.role === 'super_admin' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard" className="cursor-pointer">
                            <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/system-design" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" /> Infrastructure & Marketing
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {(session.user as any)?.role === 'admin' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard" className="cursor-pointer">
                            <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/orders" className="cursor-pointer">
                            <Truck className="mr-2 h-4 w-4" /> Manage Orders
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {(session.user as any)?.role === 'user' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard" className="cursor-pointer">
                            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/track-order" className="cursor-pointer">
                            <Truck className="mr-2 h-4 w-4" /> Track Order
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: window.location.origin })} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login" className="flex items-center gap-3 group hover:scale-110 transition-all">
                <div className="h-11 w-11 rounded-xl bg-transparent flex items-center justify-center transition-all border-none">
                  <User className="h-5 w-5 group-hover:text-primary transition-colors" />
                </div>
                <div className="hidden xl:flex flex-col transition-colors group-hover:text-primary">
                  <span className="text-[9px] opacity-40 uppercase font-black tracking-widest leading-none mb-1">Guest</span>
                  <span className="text-xs font-bold leading-none">Access Store</span>
                </div>
              </Link>
            )}

            <div className="hidden md:block">
              <CartDrawer>
                <div className="relative group flex items-center gap-3 cursor-pointer hover:scale-110 transition-all">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-xl bg-transparent flex items-center justify-center transition-all group-hover:text-primary">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    {cartItemsCount > 0 && (
                      <span className="absolute -top-2 -right-2 h-5 w-5 bg-white text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#0f1111] animate-bounce">
                        {cartItemsCount}
                      </span>
                    )}
                  </div>
                  <div className="hidden md:flex flex-col">
                    <span className="text-[9px] opacity-40 uppercase font-black tracking-widest leading-none mb-1">Your Bag</span>
                    <span className="text-xs font-bold leading-none">৳{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </CartDrawer>
            </div>
          </div>
        </div>

        {/* High-Impact Navigation (Desktop Only) */}
        <div className="bg-[#1a1c1c] border-t border-white/5">
          <div className="container mx-auto px-4 flex items-center gap-12 py-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] opacity-80 shrink-0">
              {NAV_LINKS.map((link) => (
                <Link key={link.label} href={link.href} className="hover:text-primary transition-all relative group py-1">
                  {link.label}
                  <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary transition-all group-hover:w-full" />
                </Link>
              ))}
            </div>
          </div>
        </div>

      </nav>
    </>
  );
}

