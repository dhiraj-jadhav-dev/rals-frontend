import { Component, inject, OnInit, OnDestroy } from "@angular/core";
import { CurrencyPipe, NgFor, NgIf, DecimalPipe } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { ApiService, Product } from "./api.service";

@Component({
  selector: "app-favorites",
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, DecimalPipe, RouterLink],
  templateUrl: "./favorites.component.html",
})
export class FavoritesComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  router = inject(Router);

  products: Product[] = [];
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

  openProduct(product: Product): void {
    void this.router.navigate(["/product", product.slug]);
  }

  onCardKeydown(event: KeyboardEvent, product: Product): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.openProduct(product);
  }

  shopNow(): void {
    this.router.navigateByUrl("/");
  }
}
