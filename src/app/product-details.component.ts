import { HttpErrorResponse } from "@angular/common/http";
import { CurrencyPipe, NgFor, NgIf } from "@angular/common";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription, catchError, distinctUntilChanged, map, of, switchMap, tap } from "rxjs";
import {
  ApiService,
  MAX_CART_ITEM_QUANTITY,
  Product,
  Variant,
} from "./api.service";

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const FALLBACK_IMAGE =
  "https://placehold.co/900x1100/e9e9e5/202020?text=RALS";

@Component({
  selector: "app-product-details",
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, RouterLink],
  templateUrl: "./product-details.component.html",
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  api = inject(ApiService);

  product: Product | null = null;
  loading = true;
  error = "";
  selectedImageIndex = 0;
  selectedColor = "";
  selectedSize = "";
  quantity = 1;
  added = false;
  isImageTransitioning = false;
  sizes = AVAILABLE_SIZES;

  private subscription?: Subscription;
  private imageTransitionTimeout?: number;

  ngOnInit(): void {
    this.subscription = this.route.paramMap
      .pipe(
        map((params) => params.get("slug") || ""),
        distinctUntilChanged(),
        tap(() => {
          if (this.imageTransitionTimeout !== undefined) {
            window.clearTimeout(this.imageTransitionTimeout);
            this.imageTransitionTimeout = undefined;
          }
          this.isImageTransitioning = false;
          this.loading = true;
          this.error = "";
          this.product = null;
          this.selectedImageIndex = 0;
          this.selectedColor = "";
          this.selectedSize = "";
          this.quantity = 1;
          this.added = false;
        }),
        switchMap((slug) => {
          if (!slug) {
            this.error = "Product not found.";
            return of(null);
          }
          return this.api.product(slug).pipe(
            catchError((error: HttpErrorResponse) => {
              this.error =
                error.status === 404
                  ? "We couldn't find that product."
                  : "Unable to load this product. Please try again.";
              return of(null);
            }),
          );
        }),
      )
      .subscribe((product) => {
        this.product = product;
        this.loading = false;
        if (product && this.colors.length === 1) {
          this.selectedColor = this.colors[0];
        }
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.imageTransitionTimeout !== undefined) {
      window.clearTimeout(this.imageTransitionTimeout);
    }
  }

  get colors(): string[] {
    return [...new Set((this.product?.variants || []).map((variant) => variant.color))];
  }

  get images(): Product["images"] {
    return this.product?.images || [];
  }

  get mainImage(): string {
    return this.images[this.selectedImageIndex]?.url || this.images[0]?.url || FALLBACK_IMAGE;
  }

  get mainImageAlt(): string {
    return this.images[this.selectedImageIndex]?.alt || this.product?.name || "RALS product";
  }

  get selectedVariant(): Variant | undefined {
    if (!this.product || !this.selectedColor || !this.selectedSize) return undefined;
    return this.product.variants.find(
      (variant) =>
        variant.color === this.selectedColor && variant.size === this.selectedSize,
    );
  }

  get availableStock(): number {
    return this.selectedVariant?.stock || 0;
  }

  get maxQuantity(): number {
    const variant = this.selectedVariant;
    if (!variant) return 0;
    return Math.max(
      0,
      Math.min(variant.stock, MAX_CART_ITEM_QUANTITY) -
        this.quantityInCart(variant.id),
    );
  }

  get maxCartItemQuantity(): number {
    return MAX_CART_ITEM_QUANTITY;
  }

  private quantityInCart(variantId: string): number {
    return this.api
      .cartSnapshot()
      .filter((item) => item.variantId === variantId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  get discountPercentage(): number {
    if (!this.product?.compareAt || this.product.compareAt <= this.product.price) {
      return 0;
    }
    return Math.round(
      ((this.product.compareAt - this.product.price) / this.product.compareAt) * 100,
    );
  }

  variantForSize(size: string): Variant | undefined {
    return this.product?.variants.find(
      (variant) => variant.color === this.selectedColor && variant.size === size,
    );
  }

  colorHasStock(color: string): boolean {
    return Boolean(
      this.product?.variants.some(
        (variant) => variant.color === color && variant.stock > 0,
      ),
    );
  }

  hasAvailableStock(product: Product): boolean {
    return product.variants.some((variant) => variant.stock > 0);
  }

  toggleFavorite(): void {
    if (!this.product || !this.api.requireLogin(this.router.url)) return;
    this.api.toggleFavorite(this.product);
  }

  selectColor(color: string): void {
    this.selectedColor = color;
    this.selectedSize = "";
    this.quantity = 1;
    this.added = false;
  }

  selectSize(size: string): void {
    const variant = this.variantForSize(size);
    if (!variant || variant.stock < 1) return;
    this.selectedSize = size;
    this.quantity = 1;
    this.added = false;
  }

  changeImage(index: number): void {
    if (index < 0 || index >= this.images.length || index === this.selectedImageIndex) return;
    this.isImageTransitioning = true;
    if (this.imageTransitionTimeout !== undefined) {
      window.clearTimeout(this.imageTransitionTimeout);
    }
    this.imageTransitionTimeout = window.setTimeout(() => {
      this.selectedImageIndex = index;
      window.requestAnimationFrame(() => (this.isImageTransitioning = false));
    }, 90);
  }

  stepImage(change: number): void {
    if (this.images.length < 2) return;
    this.changeImage(
      (this.selectedImageIndex + change + this.images.length) % this.images.length,
    );
  }

  decreaseQuantity(): void {
    this.quantity = Math.max(1, this.quantity - 1);
  }

  increaseQuantity(): void {
    if (this.quantity < this.maxQuantity) this.quantity++;
  }

  addToCart(): void {
    const product = this.product;
    const variant = this.selectedVariant;
    if (
      !product ||
      !variant ||
      variant.stock < 1 ||
      this.quantity > this.maxQuantity ||
      this.quantityInCart(variant.id) + this.quantity > MAX_CART_ITEM_QUANTITY
    ) {
      return;
    }
    if (!this.api.requireLogin(this.router.url)) return;

    const cart = this.api.cartSnapshot();
    const existing = cart.find((item) => item.variantId === variant.id);
    if (existing) {
      existing.quantity += this.quantity;
    } else {
      cart.push({
        variantId: variant.id,
        quantity: this.quantity,
        name: product.name,
        size: variant.size,
        color: variant.color,
        productSlug: product.slug,
      });
    }

    this.api.setCartItems(cart);
    this.added = true;
  }
}
