'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, ArrowRight, Zap, Cpu, Wifi, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Banner {
  title: string;
  subtitle?: string;
  image: string;
  link: string;
}

interface HeroV4Props {
  banners: Banner[];
}

export default function HeroV4({ banners }: HeroV4Props) {
  const mainBanner = banners?.[0] || { title: 'SYST_MEGA_SALE', image: '/placeholder.png', link: '/shop' };
  const sideBanners = banners?.slice(1, 3) || [];

  return (
    <section className="container mx-auto px-4 md:px-12 py-12 md:py-20 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-auto lg:h-[750px]">
        
        {/* Main Strategic Banner */}
        <div className="md:col-span-8 relative rounded-[2.5rem] overflow-hidden group border-2 border-neutral-100 dark:border-neutral-800 shadow-2xl">
           <Image 
              src={mainBanner.image || '/placeholder.png'} 
              alt={mainBanner.title || 'Strategic Banner'} 
              fill 
              priority
              fetchPriority="high"
              className="object-cover transition-transform duration-1000 group-hover:scale-110"
           />
           <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6 animate-in slide-in-from-left duration-700">
                 <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                 <span className="text-primary font-mono font-black uppercase tracking-[0.4em] text-[10px]">Strategic Collection / V1</span>
              </div>
              
              <h2 className="text-5xl md:text-8xl font-black text-white leading-[0.85] tracking-tighter mb-8 uppercase max-w-lg">
                {mainBanner.title}
              </h2>
              
              <p className="text-white/60 font-mono text-xs md:text-sm mb-10 max-w-sm uppercase tracking-widest leading-relaxed">
                {mainBanner.subtitle || 'Automated systems identifying premium commerce opportunities for elite selection.'}
              </p>
              
              <Button asChild className="w-fit h-16 px-12 rounded-2xl bg-primary text-white hover:bg-white hover:text-black font-mono font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 shadow-2xl shadow-primary/30 group">
                <Link href={mainBanner.link || "/shop"}>
                  Initialize Purchase <ShoppingBag className="ml-3 h-5 w-5 group-hover:rotate-12 transition-transform" />
                </Link>
              </Button>
           </div>
           
           {/* Technical Overlay */}
           <div className="absolute bottom-10 right-10 flex gap-4 hidden lg:flex">
              {[Zap, Cpu, Wifi].map((Icon, i) => (
                <div key={i} className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/50 border border-white/10 hover:text-primary transition-colors">
                   <Icon className="h-5 w-5" />
                </div>
              ))}
           </div>
        </div>

        {/* Tactical Side Grid */}
        <div className="md:col-span-4 flex flex-col gap-8">
           {sideBanners.map((banner, i) => (
              <div key={i} className="flex-1 relative rounded-[2.5rem] overflow-hidden group border-2 border-neutral-100 dark:border-neutral-800 shadow-xl animate-in slide-in-from-right duration-1000" style={{ animationDelay: `${(i + 1) * 200}ms` }}>
                 <Image 
                    src={banner.image || '/placeholder.png'} 
                    alt={banner.title || 'Side Banner'} 
                    fill 
                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                 />
                 <div className="absolute inset-0 bg-black/60 p-10 flex flex-col justify-end">
                    <span className="text-primary font-mono font-black uppercase tracking-[0.4em] text-[8px] mb-2">Module_0{(i+2)}</span>
                    <h4 className="text-white font-black text-2xl mb-4 uppercase tracking-tighter">{banner.title}</h4>
                    <Link href={banner.link || "/shop"} className="text-white/60 text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-3 hover:text-primary transition-all">
                      LINK_RECORDS <ArrowRight className="h-4 w-4" />
                    </Link>
                 </div>
              </div>
           ))}

           {/* If only one or zero side banners, fill with placeholders or system status */}
           {sideBanners.length < 2 && (
             <div className="flex-1 relative rounded-[2.5rem] bg-neutral-900 border-2 border-primary/20 p-10 flex flex-col justify-center items-center text-center space-y-4">
                <div className="h-20 w-20 rounded-full border-4 border-dashed border-primary/40 animate-spin-slow flex items-center justify-center">
                   <Cpu className="h-8 w-8 text-primary opacity-40" />
                </div>
                <div className="space-y-1">
                   <span className="text-[10px] font-mono font-black text-primary uppercase tracking-[0.5em]">SYSTEM_READY</span>
                   <p className="text-white/20 text-[9px] font-mono uppercase">Scanning for new modules...</p>
                </div>
             </div>
           )}
        </div>

      </div>
    </section>
  );
}

