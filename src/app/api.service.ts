import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { BehaviorSubject, map, tap } from "rxjs";

declare global {
  interface Window {
    RALS_API_BASE_URL?: string;
  }
}

export interface Variant {
  id: string;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

export interface ProductImage {
  id: string;
  url: string;
  publicId?: string | null;
  alt?: string | null;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt?: number;
  images: ProductImage[];
  variants: Variant[];
  category?: { id: string; name: string };
  createdAt?: string;
}

export interface HeroBanner {
  id: string;
  desktopImageUrl: string | null;
  desktopImagePublicId: string | null;
  mobileImageUrl: string | null;
  mobileImagePublicId: string | null;
  eyebrow: string;
  heading: string;
  headingAccent: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface HeroBannerMutation {
  eyebrow: string;
  heading: string;
  headingAccent: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  active: boolean;
  removeDesktopImage?: boolean;
  removeMobileImage?: boolean;
}

export interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  addresses?: SavedAddress[];
}

export interface ProfileUpdate {
  name: string;
  email: string;
  phone: string;
}

export interface AddressMutation {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CartEntry {
  variantId: string;
  quantity: number;
  name: string;
  size?: string;
  color?: string;
  productSlug?: string;
}

export const MAX_CART_ITEM_QUANTITY = 10;

export interface UploadedProductImage {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
}

export interface ProductMutation {
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  images?: Pick<UploadedProductImage, "url" | "publicId">[];
  variants?: { sku: string; size: string; color: string; stock: number }[];
}

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private base = "https://rals-backend.onrender.com/api";

  private favoritesKey = "rals_favorites";

  favorites$ = new BehaviorSubject<Product[]>(
    JSON.parse(localStorage.getItem(this.favoritesKey) || "[]"),
  );

  cart$ = new BehaviorSubject<CartEntry[]>(this.readCart());
  cartCount$ = this.cart$.pipe(
    map((items) => items.reduce((sum, item) => sum + item.quantity, 0)),
  );

  user$ = new BehaviorSubject<UserProfile | null>(
    JSON.parse(localStorage.getItem("rals_user") || "null"),
  );

  // PRODUCTS
  products() {
    return this.http.get<Product[]>(`${this.base}/products`);
  }

  adminProducts() {
    return this.http.get<Product[]>(`${this.base}/products/admin/all`);
  }

  product(id: string) {
    return this.http.get<Product>(`${this.base}/products/${id}`);
  }

  getHeroBanner() {
    return this.http.get<HeroBanner | null>(`${this.base}/hero-banner`);
  }

  adminGetHeroBanner() {
    return this.http.get<HeroBanner | null>(`${this.base}/admin/hero-banner`);
  }

  adminCreateHeroBanner(
    payload: HeroBannerMutation,
    desktopImage?: File,
    mobileImage?: File,
  ) {
    return this.http.post<HeroBanner>(
      `${this.base}/admin/hero-banner`,
      this.heroBannerForm(payload, desktopImage, mobileImage),
    );
  }

  adminUpdateHeroBanner(
    payload: HeroBannerMutation,
    desktopImage?: File,
    mobileImage?: File,
  ) {
    return this.http.put<HeroBanner>(
      `${this.base}/admin/hero-banner`,
      this.heroBannerForm(payload, desktopImage, mobileImage),
    );
  }

  adminDeleteHeroBanner() {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/admin/hero-banner`,
    );
  }

  private heroBannerForm(
    payload: HeroBannerMutation,
    desktopImage?: File,
    mobileImage?: File,
  ): FormData {
    const form = new FormData();
    form.append("eyebrow", payload.eyebrow);
    form.append("heading", payload.heading);
    form.append("headingAccent", payload.headingAccent);
    form.append("subtitle", payload.subtitle);
    form.append("buttonText", payload.buttonText);
    form.append("buttonLink", payload.buttonLink);
    form.append("active", String(payload.active));
    if (payload.removeDesktopImage) form.append("removeDesktopImage", "true");
    if (payload.removeMobileImage) form.append("removeMobileImage", "true");
    if (desktopImage) form.append("desktopImage", desktopImage);
    if (mobileImage) form.append("mobileImage", mobileImage);
    return form;
  }

  // AUTHENTICATION
  login(email: string, password: string) {
    return this.http
      .post<any>(`${this.base}/auth/login`, { email, password })
      .pipe(tap((response) => this.saveSession(response)));
  }

  register(name: string, email: string, password: string, phone: string) {
    return this.http
      .post<any>(`${this.base}/auth/register`, {
        name,
        email,
        password,
        phone,
      })
      .pipe(tap((response) => this.saveSession(response)));
  }

  getProfile() {
    return this.http.get<UserProfile>(`${this.base}/auth/profile`);
  }

  updateProfile(payload: ProfileUpdate) {
    return this.http.patch<UserProfile>(`${this.base}/auth/profile`, payload);
  }

  createSavedAddress(payload: AddressMutation) {
    return this.http.post<SavedAddress>(
      `${this.base}/auth/profile/addresses`,
      payload,
    );
  }

  updateSavedAddress(id: string, payload: AddressMutation) {
    return this.http.put<SavedAddress>(
      `${this.base}/auth/profile/addresses/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deleteSavedAddress(id: string) {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/auth/profile/addresses/${encodeURIComponent(id)}`,
    );
  }

  updateCachedProfile(user: UserProfile) {
    localStorage.setItem("rals_user", JSON.stringify(user));
    this.user$.next(user);
  }

  private saveSession(response: any) {
    if (response?.accessToken) {
      localStorage.setItem("rals_token", response.accessToken);
    }

    if (response?.user) {
      this.updateCachedProfile(response.user);
    }
  }

  cartSnapshot(): CartEntry[] {
    return this.cart$.value;
  }

  setCartItems(items: CartEntry[]): void {
    sessionStorage.setItem("rals_cart", JSON.stringify(items));
    this.cart$.next(items);
  }

  clearCart(): void {
    sessionStorage.removeItem("rals_cart");
    this.cart$.next([]);
  }

  private readCart(): CartEntry[] {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem("rals_cart") || "[]",
      );
      return Array.isArray(saved) ? saved.filter(isCartEntry) : [];
    } catch {
      return [];
    }
  }

  logout() {
    localStorage.removeItem("rals_token");
    localStorage.removeItem("rals_user");
    this.user$.next(null);
  }

  requireLogin(returnUrl: string): boolean {
    if (this.user$.value) {
      return true;
    }

    void this.router.navigate(["/login"], {
      queryParams: { returnUrl },
    });
    return false;
  }

  // ORDERS
  createOrder(payload: any) {
    return this.http.post<any>(`${this.base}/orders`, payload);
  }

  myOrders() {
    return this.http.get<any[]>(`${this.base}/orders/mine`);
  }

  adminOrders() {
    return this.http.get<any[]>(`${this.base}/orders`);
  }

  adminUpdateOrder(id: string, status: string) {
    return this.http.patch<any>(`${this.base}/orders/${id}/status`, { status });
  }

  // CASHFREE PAYMENTS
  createCashfreeSession(orderId: string) {
    return this.http.post<any>(`${this.base}/payments/cashfree/session`, {
      orderId,
    });
  }

  verifyCashfree(orderId: string) {
    return this.http.post<any>(`${this.base}/payments/cashfree/verify`, {
      orderId,
    });
  }

  // ADMIN PRODUCTS
  adminCreateProduct(payload: ProductMutation) {
    return this.http.post<Product>(`${this.base}/products`, payload);
  }

  adminUpdateProduct(id: string, payload: Partial<ProductMutation>) {
    return this.http.put<Product>(`${this.base}/products/${id}`, payload);
  }

  adminAddProductImages(
    id: string,
    images: Pick<UploadedProductImage, "url" | "publicId">[],
  ) {
    return this.http.post<ProductImage[]>(`${this.base}/products/${id}/images`, {
      images,
    });
  }

  adminDeleteProductImage(id: string, imageId: string) {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/products/${id}/images/${imageId}`,
    );
  }

  adminAddVariant(
    productId: string,
    variant: { sku: string; size: string; color: string; stock: number },
  ) {
    return this.http.post<Variant>(
      `${this.base}/products/${productId}/variants`,
      variant,
    );
  }

  adminUpdateVariantStock(variantId: string, stock: number) {
    return this.http.patch<Variant>(
      `${this.base}/products/variants/${variantId}/stock`,
      { stock },
    );
  }

  adminDeleteVariant(variantId: string) {
    return this.http.delete<Variant>(
      `${this.base}/products/variants/${variantId}`,
    );
  }

  adminDeleteProduct(id: string) {
    return this.http.delete<any>(`${this.base}/products/${id}`);
  }

  // PRODUCT IMAGE UPLOAD
  uploadProductImage(file: File) {
    const form = new FormData();
    form.append("file", file);

    return this.http.post<{ url: string }>(
      `${this.base}/uploads/product-image`,
      form,
    );
  }

  uploadProductImages(files: File[]) {
    const form = new FormData();
    for (const file of files) form.append("files", file);

    return this.http.post<{ images: UploadedProductImage[] }>(
      `${this.base}/uploads/product-images`,
      form,
    );
  }

  // FAVORITES
  private saveFavorites(products: Product[]) {
    localStorage.setItem(this.favoritesKey, JSON.stringify(products));

    this.favorites$.next(products);
  }

  isFavorite(productId: string): boolean {
    return this.favorites$.value.some((product) => product.id === productId);
  }

  toggleFavorite(product: Product): void {
    const current = this.favorites$.value;

    const exists = current.some((item) => item.id === product.id);

    const updated = exists
      ? current.filter((item) => item.id !== product.id)
      : [...current, product];

    this.saveFavorites(updated);
  }

  removeFavorite(productId: string): void {
    const updated = this.favorites$.value.filter(
      (product) => product.id !== productId,
    );

    this.saveFavorites(updated);
  }

  clearFavorites(): void {
    this.saveFavorites([]);
  }
}

function isCartEntry(value: unknown): value is CartEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["variantId"] === "string" &&
    typeof item["name"] === "string" &&
    Number.isInteger(item["quantity"]) &&
    Number(item["quantity"]) > 0
  );
}
