import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { BehaviorSubject, tap } from "rxjs";

export interface Variant {
  id: string;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt?: number;
  images: { url: string; alt?: string }[];
  variants: Variant[];
  category?: { name: string };
}

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Change this to your backend ngrok URL when using mobile.
  private base = "http://localhost:3000/api";

  private favoritesKey = "rals_favorites";

  favorites$ = new BehaviorSubject<Product[]>(
    JSON.parse(localStorage.getItem(this.favoritesKey) || "[]"),
  );

  user$ = new BehaviorSubject<any>(
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

  private saveSession(response: any) {
    if (response?.accessToken) {
      localStorage.setItem("rals_token", response.accessToken);
    }

    if (response?.user) {
      localStorage.setItem("rals_user", JSON.stringify(response.user));

      this.user$.next(response.user);
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
  adminCreateProduct(payload: any) {
    return this.http.post<any>(`${this.base}/products`, payload);
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
