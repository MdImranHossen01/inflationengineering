
import { ProductCardSelector } from '@/components/templates/Registry';
import { Product } from '@/types/product';

export function ProductCard({ style = 'v1', product, isFlashSale, priority }: { style?: string, product: Product, isFlashSale?: boolean, priority?: boolean }) {
  return <ProductCardSelector style={style} product={product} isFlashSale={isFlashSale} priority={priority} />;
}

