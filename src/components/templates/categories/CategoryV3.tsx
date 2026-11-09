/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { Cpu, MoveRight, Layers } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

interface CategoryV3Props {
  categories: Category[];
}

export default function CategoryV3({ categories }: CategoryV3Props) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="bg-neutral-50 dark:bg-[#0a0a0a] py-32 px-6">
      <div className="container mx-auto">
        <div className="flex items-end justify-between mb-20 gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary font-mono font-black uppercase tracking-[0.4em] text-[10px]">
                 <Layers className="h-4 w-4" /> System_Architecture
              </div>
              <h2 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-[0.8]">
                Logic Grid
              </h2>
           </div>
           <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest max-w-xs text-right leading-relaxed opacity-60">
             Systematically identifying and indexing primary commerce modules.
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-2 border-neutral-200 dark:border-neutral-800 rounded-[3rem] overflow-hidden">
           {categories.slice(0, 9).map((category, i) => (
             <Link 
               key={category._id} 
               href={`/shop?category=${encodeURIComponent(category.slug)}`}
               className="group relative p-12 border border-neutral-200 dark:border-neutral-800 hover:bg-primary transition-all duration-500"
             >
                <div className="flex flex-col gap-12">
                   <div className="flex justify-between items-start">
                      <div className="h-16 w-16 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 group-hover:bg-white group-hover:text-primary transition-all shadow-sm">
                         <Cpu className="h-8 w-8" />
                      </div>
                      <span className="text-[10px] font-mono font-black text-muted-foreground group-hover:text-white/40">ID_0{(i+1)}</span>
                   </div>
                   
                   <div className="space-y-4">
                      <h3 className="text-3xl font-black text-foreground group-hover:text-white uppercase tracking-tighter">{category.name}</h3>
                      <div className="flex items-center gap-3 text-[10px] font-mono font-black uppercase tracking-widest text-primary group-hover:text-white">
                         ACCESS_MODULE <MoveRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                      </div>
                   </div>
                </div>
                
                {/* Background Text Decor */}
                <div className="absolute right-[-10%] bottom-[-5%] text-[8rem] font-black opacity-[0.03] group-hover:opacity-10 transition-opacity select-none pointer-events-none uppercase">
                   {category.name.slice(0, 3)}
                </div>
             </Link>
           ))}
        </div>
      </div>
    </section>
  );
}

