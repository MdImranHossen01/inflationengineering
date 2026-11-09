/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import connectToDatabase from '@/lib/db';
import Banner from '@/models/Banner';
import Category from '@/models/Category';
import Product from '@/models/Product';
import Blog from '@/models/Blog';
import FAQ from '@/models/FAQ';
import GlobalSettings from '@/models/GlobalSettings';
import Coupon from '@/models/Coupon';
import dynamic from 'next/dynamic';
import { HeroSlider } from '@/components/storefront/HeroSlider';
import { FreeDeliveryBanner } from '@/components/storefront/FreeDeliveryBanner';
import {
  SectionSkeleton,
  CategoryShowcaseSkeleton,
  BannerSkeleton,
  BlogRecentSkeleton,
  FeaturesSectionSkeleton,
  FAQSectionSkeleton,
  TestimonialsSkeleton
} from '@/components/storefront/Skeletons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { headers } from 'next/headers';
import {
  getCachedBanners,
  getCachedCategories,
  getCachedProducts,
  getTrendingProducts,
  getCachedBlogs,
  getCachedFAQs,
  getCachedSettings,
  getCachedActiveCoupon
} from '@/lib/data-fetching';
import { generateOrganizationSchema } from '@/lib/seo';
import Script from 'next/script';

const sanitizeForScript = (json: any) => {
  return JSON.stringify(json).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
};

export async function generateMetadata(): Promise<Metadata> {
  const [settings, banners] = await Promise.all([
    getCachedSettings(),
    getCachedBanners()
  ]);

  const brandName = settings?.brandName || 'Inflation Engineering';
  const metaTitle = settings?.metaTitle || brandName;
  const description = settings?.metaDescription || settings?.siteDescription || 'Your ultimate destination for quality products.';
  const ogImage = banners?.[0]?.image || settings?.logoUrl || '';

  const headersList = await headers();
  const hostname = headersList.get('host') || 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${hostname}`;

  return {
    title: {
      default: metaTitle,
      template: `%s | ${brandName}`,
    },
    description,
    openGraph: {
      title: brandName,
      description,
      url: baseUrl,
      siteName: brandName,
      images: ogImage ? [ogImage] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: brandName,
      description,
      images: ogImage ? [ogImage] : [],
    },
    metadataBase: new URL(baseUrl),
  };
}

// Lazy load components below the fold
const CategoryShowcase = dynamic(() => import('@/components/storefront/CategoryShowcase').then(mod => mod.CategoryShowcase), {
  loading: () => <CategoryShowcaseSkeleton />
});

const ProductCarouselSection = dynamic(() => import('@/components/storefront/ProductCarouselSection').then(mod => mod.ProductCarouselSection), {
  loading: () => <SectionSkeleton />
});

const BlogRecent = dynamic(() => import('@/components/storefront/BlogRecent').then(mod => mod.BlogRecent), {
  loading: () => <BlogRecentSkeleton />
});

const FAQSection = dynamic(() => import('@/components/storefront/FAQSection').then(mod => mod.FAQSection), {
  loading: () => <FAQSectionSkeleton />
});

const Testimonials = dynamic(() => import('@/components/storefront/Testimonials').then(mod => mod.Testimonials), {
  loading: () => <TestimonialsSkeleton />
});

const FeaturesSection = dynamic(() => import('@/components/storefront/FeaturesSection').then(mod => mod.FeaturesSection), {
  loading: () => <FeaturesSectionSkeleton />
});

const LoyaltyBanner = dynamic(() => import('@/components/storefront/LoyaltyBanner').then(mod => mod.LoyaltyBanner), {
  loading: () => <BannerSkeleton />
});

const ComboOfferBanner = dynamic(() => import('@/components/storefront/ComboOfferBanner').then(mod => mod.ComboOfferBanner), {
  loading: () => <BannerSkeleton />
});

const NewsletterV2 = dynamic(() => import('@/components/storefront/NewsletterV2').then(mod => mod.NewsletterV2), {
  loading: () => <BannerSkeleton />
});

async function getHomeData() {
  try {
    const [
      banners,
      categories,
      featuredProducts,
      newArrivals,
      flashSale,
      trending,
      blogs,
      faqs,
      settings,
      activeCoupon
    ] = await Promise.all([
      getCachedBanners(),
      getCachedCategories(),
      getCachedProducts({ isFeatured: true }, 10),
      getCachedProducts({ isNewArrival: true }, 10),
      getCachedProducts({ salePrice: { $exists: true, $ne: null } }, 10, { salePrice: 1 }),
      getTrendingProducts(10),
      getCachedBlogs(1),
      getCachedFAQs(),
      getCachedSettings(),
      getCachedActiveCoupon()
    ]);

    return {
      banners,
      categories,
      featuredProducts,
      newArrivals,
      flashSale,
      trending,
      blogs,
      faqs: faqs && faqs.length > 0 ? faqs : [],
      settings,
      activeCoupon
    };
  } catch (error) {
    console.error("Error fetching home data via cache:", error);
    return {
      banners: [],
      categories: [],
      featuredProducts: [],
      newArrivals: [],
      flashSale: [],
      trending: [],
      blogs: [],
      faqs: []
    };
  }
}

export default async function Home() {
  const data = await getHomeData();
  const ui = {
    hero: data.settings?.uiTemplates?.hero || 'v1',
    categories: data.settings?.uiTemplates?.categories || 'v1',
    productCard: data.settings?.uiTemplates?.productCard || 'v1'
  };

  const orgSchema = data.settings ? await generateOrganizationSchema(data.settings) : null;

  return (
    <div className="flex flex-col min-h-screen">
      {orgSchema && (
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sanitizeForScript(orgSchema) }}
        />
      )}
      {/* 0. Free Delivery Announcement Bar */}
      <FreeDeliveryBanner settings={data.settings} />

      {/* 1. Hero Section */}
      <HeroSlider banners={data.banners} style={ui.hero} />

      {/* 4. Categories Showcase */}
      <CategoryShowcase categories={data.categories} style={ui.categories} />

      {/* 8. Featured Products */}
      {data.featuredProducts.length > 0 && (
        <ProductCarouselSection
          title="Featured Collections"
          description="Explore our best-selling and most popular products hand-picked just for you."
          products={data.featuredProducts}
          viewAllLink="/shop?filter=featured"
          bgColor="bg-background"
          cardStyle={ui.productCard}
        />
      )}

      {/* 8. Loyalty Promotion */}
      <LoyaltyBanner settings={data.settings} />

      {/* 3. Flash Sale (Timed) */}
      {data.flashSale.length > 0 && (
        <ProductCarouselSection
          title="Flash Sale"
          products={data.flashSale}
          viewAllLink="/shop?filter=sale"
          isFlashSale={true}
          bgColor="bg-primary/5"
          cardStyle={ui.productCard}
        />
      )}

      {/* 7. Combo Discount Promotion */}
      <ComboOfferBanner activeCoupon={data.activeCoupon} settings={data.settings} />

      {/* 6. Trending Products */}
      {data.trending.length > 0 && (
        <ProductCarouselSection
          title="Trending Now"
          description="The most popular items according to our community ratings and reviews."
          products={data.trending}
          viewAllLink="/shop?filter=trending"
          bgColor="bg-muted/20"
          cardStyle={ui.productCard}
        />
      )}

      {/* 9. Recent Blogs section */}
      <BlogRecent blogs={data.blogs} />

      {/* 5. New Arrivals */}
      {data.newArrivals.length > 0 && (
        <ProductCarouselSection
          title="New Arrivals"
          description="Discover the latest additions to our collection. Stay ahead of the curve."
          products={data.newArrivals}
          viewAllLink="/shop?filter=new"
          bgColor="bg-background"
          cardStyle={ui.productCard}
        />
      )}

      {/* 2. Our Features (Trust Badges) */}
      <FeaturesSection />

      {/* 8. Testimonials Section */}
      <Testimonials />

      {/* 11. Newsletter V2 Integration */}
      <NewsletterV2 />

      {/* 10. FAQ Accordion Section */}
      <FAQSection faqs={data.faqs} />

    </div>
  );
}

