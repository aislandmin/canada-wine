export interface SpecItem {
  label: string;
  value: string;
}

/** One product as written in src/data/products.ts. */
export interface ProductData {
  /** Catalogue number, e.g. "06". Also the page address (/products/06), so keep it unique. */
  catalogNo: string;
  category: string;
  nameZh: string;
  nameEn: string;
  winery: string;
  vintage: string;
  volume: string;
  tastingNotes: string;
  styleLabel: string;
  styleDescription: string;
  servingTemp: string;
  pairing: string;
  specs: SpecItem[];
  awards: string[];
  /** File names in src/data/photos/, main photo first. */
  photos: string[];
}

export interface ProductImage {
  id: number;
  url: string;
}

/** A product ready for display, with photo file names turned into URLs. */
export interface Product extends Omit<ProductData, 'photos' | 'category'> {
  id: string;
  categoryName: string | null;
  /** The main photo (first of `images`), or null. Used on product cards. */
  imageUrl: string | null;
  images: ProductImage[];
}
