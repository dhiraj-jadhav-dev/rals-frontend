import { Component, inject, OnInit } from "@angular/core";
import { CurrencyPipe, NgFor, NgIf } from "@angular/common";
import { Router } from "@angular/router";
import {
  ApiService,
  CartEntry,
  MAX_CART_ITEM_QUANTITY,
  Product,
} from "./api.service";

interface CartDisplayItem extends CartEntry {
  product?: Product;
  size: string;
  color: string;
  stock: number;
  unitPrice: number;
  unavailable: boolean;
}

@Component({
  selector: "app-cart",
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf],
  templateUrl: "./cart.component.html",
})
export class CartComponent implements OnInit {
  api = inject(ApiService);
  router = inject(Router);

  cartItems: CartDisplayItem[] = [];
  loading = true;
  error = "";
  stockWarning = "";

  shippingThreshold = 99900;
  shippingCharge = 0;
  maxCartItemQuantity = MAX_CART_ITEM_QUANTITY;

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    const items = this.api.cartSnapshot();
    if (!items.length) {
      this.cartItems = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    this.api.products().subscribe({
      next: (products) => {
        this.hydrateCart(items, products);
        this.loading = false;
        this.error = "";
      },
      error: () => {
        this.error = "Unable to load your cart. Please try again.";
        this.loading = false;
      },
    });
  }

  private hydrateCart(items: CartEntry[], products: Product[]): void {
    this.cartItems = items.map((item) => {
      const product =
        products.find((candidate) =>
          candidate.variants?.some((variant) => variant.id === item.variantId),
        ) || products.find((candidate) => candidate.slug === item.productSlug);
      const variant = product?.variants?.find(
        (candidate) => candidate.id === item.variantId,
      );
      const stock = variant?.stock ?? 0;

      return {
        ...item,
        name: product?.name || item.name,
        product,
        size: variant?.size || item.size || "Unavailable",
        color: variant?.color || item.color || "Unavailable",
        stock,
        unitPrice: product?.price || 0,
        unavailable:
          !variant ||
          stock < 1 ||
          item.quantity > stock ||
          item.quantity > MAX_CART_ITEM_QUANTITY,
      };
    });
    this.syncCart();
    this.stockWarning = this.hasUnavailableStock
      ? "Some items are unavailable, exceed stock, or exceed the per-size order limit. Update or remove them to continue."
      : "";
  }

  get subtotal(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
  }

  get totalQuantity(): number {
    return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  get shipping(): number {
    return this.subtotal >= this.shippingThreshold ? 0 : this.shippingCharge;
  }

  get total(): number {
    return this.subtotal + this.shipping;
  }

  get remainingForFreeShipping(): number {
    return Math.max(0, this.shippingThreshold - this.subtotal);
  }

  get hasUnavailableStock(): boolean {
    return this.cartItems.some((item) => item.unavailable);
  }

  updateQuantity(item: CartDisplayItem, change: number): void {
    if (!this.api.requireLogin(this.router.url)) return;
    const newQuantity = item.quantity + change;
    if (newQuantity < 1) return;
    if (
      change > 0 &&
      (item.unavailable ||
        newQuantity > item.stock ||
        newQuantity > MAX_CART_ITEM_QUANTITY)
    ) {
      alert(
        `Maximum available quantity is ${Math.min(item.stock, MAX_CART_ITEM_QUANTITY)}.`,
      );
      return;
    }

    item.quantity = newQuantity;
    item.unavailable =
      item.stock < 1 ||
      item.quantity > item.stock ||
      item.quantity > MAX_CART_ITEM_QUANTITY;
    this.syncCart();
    this.stockWarning = this.hasUnavailableStock
      ? "Some items are unavailable, exceed stock, or exceed the per-size order limit. Update or remove them to continue."
      : "";
  }

  removeItem(variantId: string): void {
    if (!this.api.requireLogin(this.router.url)) return;
    this.cartItems = this.cartItems.filter(
      (item) => item.variantId !== variantId,
    );
    this.syncCart();
    this.stockWarning = this.hasUnavailableStock
      ? "Some items are unavailable, exceed stock, or exceed the per-size order limit. Update or remove them to continue."
      : "";
  }

  private syncCart(): void {
    const items = this.cartItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      name: item.product?.name || item.name,
      size: item.size,
      color: item.color,
      productSlug: item.product?.slug || item.productSlug,
    }));
    this.api.setCartItems(items);
  }

  image(item: CartDisplayItem): string {
    return (
      item.product?.images?.[0]?.url ||
      "https://placehold.co/700x900/e9e9e5/202020?text=RALS"
    );
  }

  stockStatus(item: CartDisplayItem): string {
    if (item.stock < 1) return "OUT OF STOCK";
    if (item.quantity > item.stock) {
      return `ONLY ${item.stock} AVAILABLE — QUANTITY EXCEEDS STOCK`;
    }
    if (item.quantity > MAX_CART_ITEM_QUANTITY) {
      return `MAXIMUM ${MAX_CART_ITEM_QUANTITY} PER SIZE PER ORDER`;
    }
    return "STOCK UNAVAILABLE";
  }

  checkout(): void {
    if (!this.cartItems.length || !this.api.requireLogin(this.router.url)) return;

    this.loading = true;
    this.error = "";
    this.api.products().subscribe({
      next: (products) => {
        const currentItems = this.api.cartSnapshot();
        this.hydrateCart(currentItems, products);
        this.loading = false;
        if (this.hasUnavailableStock) {
          this.stockWarning =
            "Stock changed. Please correct your bag before checkout.";
          return;
        }
        this.router.navigateByUrl("/checkout");
      },
      error: () => {
        this.loading = false;
        this.error = "Unable to verify current stock. Please try again.";
      },
    });
  }

  continueShopping(): void {
    this.router.navigateByUrl("/");
  }
}
