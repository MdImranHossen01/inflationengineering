
import { HeroSelector } from '@/components/templates/Registry';

export function HeroSlider({ style = 'v1', banners }: { style?: string, banners: any[] }) {
  return <HeroSelector style={style} banners={banners} />;
}

