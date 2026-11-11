import { Component, inject, OnInit, OnDestroy } from "@angular/core";
import { CurrencyPipe, NgFor, NgIf, DecimalPipe } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { ApiService, Product } from "./api.service";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-favorites",
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, DecimalPipe, RouterLink, FormsModule],
  templateUrl: "./favorites.component.html",
})
export class FavoritesComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  router = inject(Router);

  products: Product[] = [];
  selected: Record<string, string> = {};
  private subscription?: Subscription;

  fallback = "https://placehold.co/700x900/e9e9e5/202020?text=RALS";

  ngOnInit(): void {
    this.subscription = this.api.favorites$.subscribe((products) => {
      this.products = products;
      
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  image(p: Product): string {
    return p.images?.[0]?.url || this.fallback;
  }

  remove(p: Product): void {
    if (!this.api.requireLogin(this.router.url)) return;

    this.api.removeFavorite(p.id);
  }

  addToBag(p: Product): void {
    if (!this.api.requireLogin(this.router.url)) return;

    const variantId = this.selected[p.id];

    if (!variantId) {
      alert("Please select your size and colour first.");
      return;
    }

    const variant = p.variants?.find((v) => v.id === variantId);

    if (!variant || variant.stock < 1) {
      alert("This option is out of stock.");
      return;
    }

    const cart = JSON.parse(sessionStorage.getItem("rals_cart") || "[]");

    const existing = cart.find((item: any) => item.variantId === variantId);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        variantId,
        quantity: 1,
        name: p.name,
      });
    }

    sessionStorage.setItem("rals_cart", JSON.stringify(cart));

    alert(`${p.name} added to your bag!`);
  }

  shopNow(): void {
    this.router.navigateByUrl("/");
  }
}
