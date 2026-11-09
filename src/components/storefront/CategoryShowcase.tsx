
import { CategorySelector } from '@/components/templates/Registry';

export function CategoryShowcase({ style = 'v1', categories }: { style?: string, categories: any[] }) {
  const mainCategories = (categories || []).filter((cat: any) => !cat.parentCategory);
  return <CategorySelector style={style} categories={mainCategories} />;
}

