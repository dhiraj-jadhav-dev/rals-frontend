import { Component, inject, OnInit } from "@angular/core";
import { CurrencyPipe, DecimalPipe, NgFor, NgIf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService, Product } from "./api.service";
import { Router, RouterLink } from "@angular/router";

@Component({
  selector: "app-store",
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, NgFor, NgIf, FormsModule, RouterLink],
  templateUrl: "./store.component.html",
})
export class StoreComponent implements OnInit {
  api = inject(ApiService);
  router = inject(Router);

  products: Product[] = [];
  filtered: Product[] = [];

  cart: {
    variantId: string;
    quantity: number;
    name: string;
  }[] = [];

  selected: Record<string, string> = {};

  search = "";
  activeCategory = "ALL";
  sort = "featured";

  error = "";
  added = "";

  fallback =
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85";

  ngOnInit(): void {
    this.loadCart();
    this.loadProducts();
  }

  loadProducts(): void {
    this.api.products().subscribe({
      next: (products) => {
        this.products = products || [];
        for (const product of this.products) {
          if (this.selected[product.id] === undefined) {
            this.selected[product.id] = "";
          }
        }
        this.error = "";
        this.applyFilters();
      },
      error: () => {
        this.error =
          "Could not load products. Please check that the API is running.";
      },
    });
  }

  loadCart(): void {
    try {
      const saved = sessionStorage.getItem("rals_cart");
      this.cart = saved ? JSON.parse(saved) : [];
    } catch {
      this.cart = [];
    }
  }

  saveCart(): void {
    sessionStorage.setItem("rals_cart", JSON.stringify(this.cart));
  }

  applyFilters(): void {
    let list = [...this.products];

    if (this.activeCategory !== "ALL") {
      const term = this.activeCategory.toLowerCase();

      list = list.filter((p) => {
        const category = p.category?.name || "";
        return (
          category.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term)
        );
      });
    }

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();

      list = list.filter((p) =>
        `${p.name} ${p.description || ""} ${p.category?.name || ""}`
          .toLowerCase()
          .includes(q),
      );
    }

    if (this.sort === "price-low") {
      list.sort((a, b) => a.price - b.price);
    }

    if (this.sort === "price-high") {
      list.sort((a, b) => b.price - a.price);
    }

    this.filtered = list;
  }

  chooseCategory(category: string): void {
    this.activeCategory = category;
    this.applyFilters();

    document
      .getElementById("collection")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  add(p: Product): void {
    if (!this.api.requireLogin(this.router.url)) return;

    const variantId = this.selected[p.id];

    if (!variantId) {
      this.added = "Choose a size and colour first.";
      return;
    }

    const variant = p.variants?.find((v) => v.id === variantId);

    if (!variant || variant.stock < 1) {
      this.added = "This option is currently out of stock.";
      return;
    }

    const item = this.cart.find((x) => x.variantId === variantId);

    if (item) {
      if (item.quantity >= variant.stock) {
        this.added = "Maximum available stock reached.";
        return;
      }
      item.quantity++;
    } else {
      this.cart.push({
        variantId,
        quantity: 1,
        name: p.name,
      });
    }

    this.saveCart();
    this.added = `${p.name} added to your bag.`;
  }

  get cartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  checkout(): void {
    this.saveCart();
    this.router.navigateByUrl("/checkout");
  }

  image(p: Product): string {
    const url = p.images?.[0]?.url;

    if (url && !url.includes("placehold.co")) {
      return url;
    }

    return this.fallback;
  }

  toggleFavorite(p: Product) {
    if (!this.api.requireLogin(this.router.url)) return;

    this.api.toggleFavorite(p);
  }
}
