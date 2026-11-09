/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// Loyalty promotion banner component for home page
import { Trophy, Wallet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface LoyaltyBannerProps {
  settings: any;
}

export function LoyaltyBanner({ settings }: LoyaltyBannerProps) {
  const subConfig = settings?.subscriptionConfig;
  const isExplicitlyDisabled = subConfig?.enabled === false;
  const threshold = Number(subConfig?.activationThreshold ?? 0);
  const percentage = Number(subConfig?.rewardPercentage ?? 0);

  // If loyalty rewards are disabled or not configured (threshold <= 0 or percentage <= 0), hide banner completely
  if (isExplicitlyDisabled || threshold <= 0 || percentage <= 0) {
    return null;
  }

  const brandName = settings?.brandName;

  return (
    <section className="py-16 bg-zinc-950 border-y border-white/[0.05] text-white overflow-hidden relative">
      <div className="container px-4 mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight md:tracking-tighter leading-tight md:leading-none break-words">
              JOIN THE {brandName ? <span className="text-primary">{brandName} </span> : null}LOYALTY CLUB
            </h2>
            <p className="text-gray-400 text-lg max-w-md">
              Unlock exclusive lifetime benefits. Spend <span className="text-white font-bold">৳{threshold}</span> once and earn <span className="text-primary font-bold">{percentage}% tokens</span> on every future purchase!
            </p>

            <div className="flex flex-wrap gap-4">
              <Button asChild className="rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black">
                <Link href="/shop">
                  SHOP & ACTIVATE NOW
                </Link>
              </Button>
              <Button asChild className="rounded-full px-8 h-12 bg-transparent border-2 border-white text-white hover:bg-white hover:text-black font-bold transition-colors">
                <Link href="/register">
                  CREATE ACCOUNT
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">Activate</h3>
              <p className="text-xs text-neutral-400">Buy products worth ৳{threshold} in a single order.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">Earn Tokens</h3>
              <p className="text-xs text-neutral-400">Get {percentage}% back as tokens on every future order.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors group">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">Save Big</h3>
              <p className="text-xs text-neutral-400">Use tokens for instant discounts on your next checkout.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


