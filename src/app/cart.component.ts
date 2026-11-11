
import { Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Product } from './api.service';

interface CartItem {
  variantId: string;
  quantity: number;
  name: string;
}

interface CartDisplayItem extends CartItem {
  product: Product;
  size: string;
  color: string;
  stock: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, RouterLink],
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit {
  api = inject(ApiService);
  router = inject(Router);

  items: CartItem[] = [];
  cartItems: CartDisplayItem[] = [];

  loading = true;
  error = '';

  shippingThreshold = 99900;
  shippingCharge = 0;

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    try {
      this.items = JSON.parse(
        sessionStorage.getItem('rals_cart') || '[]'
      );
    } catch {
      this.items = [];
    }

    if (!this.items.length) {
      this.cartItems = [];
      this.loading = false;
      return;
    }

    this.api.products().subscribe({
      next: (products) => {
        this.cartItems = this.items
          .map(item => {
            const product = products.find(p =>
              p.variants?.some(v => v.id === item.variantId)
            );

            if (!product) return null;

            const variant = product.variants.find(
              v => v.id === item.variantId
            );

            if (!variant) return null;

            return {
              ...item,
              product,
              size: variant.size,
              color: variant.color,
              stock: variant.stock
            };
          })
          .filter((item): item is CartDisplayItem => item !== null);

        this.items = this.cartItems.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          name: item.product.name
        }));

        this.saveCart();
        this.loading = false;
        this.error = '';
      },
      error: () => {
        this.error = 'Unable to load your cart. Please try again.';
        this.loading = false;
      }
    });
  }

  get subtotal(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }

  get totalQuantity(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  get shipping(): number {
    return this.subtotal >= this.shippingThreshold
      ? 0
      : this.shippingCharge;
  }

  get total(): number {
    return this.subtotal + this.shipping;
  }

  get remainingForFreeShipping(): number {
    return Math.max(0, this.shippingThreshold - this.subtotal);
  }

  get hasUnavailableStock(): boolean {
    return this.cartItems.some(item =>
      item.quantity > item.stock || item.stock < 1
    );
  }

  updateQuantity(item: CartDisplayItem, change: number): void {
    if (!this.api.requireLogin(this.router.url)) return;

    const newQuantity = item.quantity + change;

    if (newQuantity < 1) return;

    if (newQuantity > item.stock) {
      alert('Maximum available stock reached.');
      return;
    }

    item.quantity = newQuantity;
    this.syncCart();
  }

  removeItem(variantId: string): void {
    if (!this.api.requireLogin(this.router.url)) return;

    this.cartItems = this.cartItems.filter(
      item => item.variantId !== variantId
    );

    this.syncCart();
  }

  saveCart(): void {
    sessionStorage.setItem(
      'rals_cart',
      JSON.stringify(this.items)
    );
  }

  syncCart(): void {
    this.items = this.cartItems.map(item => ({
      variantId: item.variantId,
      quantity: item.quantity,
      name: item.product.name
    }));

    this.saveCart();
  }

  image(product: Product): string {
    return product.images?.[0]?.url ||
      'https://placehold.co/700x900/e9e9e5/202020?text=RALS';
  }

  checkout(): void {
    if (!this.cartItems.length) return;

    if (this.hasUnavailableStock) {
      alert('Please review the available stock before checkout.');
      return;
    }

    this.syncCart();
    this.router.navigateByUrl('/checkout');
  }

  continueShopping(): void {
    this.router.navigateByUrl('/');
  }
}
