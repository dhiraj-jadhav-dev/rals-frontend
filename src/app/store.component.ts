import { Component, inject, OnInit } from "@angular/core";
import { CurrencyPipe, DecimalPipe, NgFor, NgIf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService, HeroBanner, Product } from "./api.service";
import { Router, RouterLink } from "@angular/router";

const DEFAULT_HERO_BANNER: HeroBanner = {
  id: "home",
  desktopImageUrl: null,
  desktopImagePublicId: null,
  mobileImageUrl: null,
  mobileImagePublicId: null,
  eyebrow: "NEW COLLECTION / DROP 01",
  heading: "DRESS DIFFERENT.",
  headingAccent: "FEEL RALS.",
  subtitle: "Contemporary essentials for every mood.",
  buttonText: "SHOP NEW DROP",
  buttonLink: "#collection",
  active: true,
};

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
  productSkeletons = [0, 1, 2, 3];
  productsLoading = true;
  heroBanner = DEFAULT_HERO_BANNER;
  heroError = "";

  selectedImage: Record<string, number> = {};
  private imageSwipeStart: {
    productId: string;
    x: number;
    y: number;
  } | null = null;
  private suppressedCardClickId: string | null = null;
  private suppressedCardClickUntil = 0;

  search = "";
  activeCategory = "ALL";
  sort = "featured";

  error = "";
  added = "";

  fallback =
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85";

  ngOnInit(): void {
    this.loadHeroBanner();
    this.loadProducts();
  }

  loadHeroBanner(): void {
    this.api.getHeroBanner().subscribe({
      next: (banner) => {
        this.heroBanner = banner ?? DEFAULT_HERO_BANNER;
        this.heroError = "";
      },
      error: () => {
        this.heroError = "Hero banner settings are temporarily unavailable.";
      },
    });
  }

  get heroDesktopImage(): string {
    return (
      this.heroBanner.desktopImageUrl ||
      "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=2200&q=88"
    );
  }

  get heroCtaIsExternal(): boolean {
    return /^https:\/\//i.test(this.heroBanner.buttonLink);
  }

  get heroCtaRouterLink(): string[] {
    return this.heroBanner.buttonLink.startsWith("#")
      ? []
      : [this.heroBanner.buttonLink];
  }

  get heroCtaFragment(): string | undefined {
    return this.heroBanner.buttonLink.startsWith("#")
      ? this.heroBanner.buttonLink.slice(1)
      : undefined;
  }

  loadProducts(): void {
    this.productsLoading = true;
    this.error = "";
    this.api.products().subscribe({
      next: (products) => {
        this.products = products || [];
        for (const product of this.products) {
          this.selectedImage[product.id] ??= 0;
        }
        this.error = "";
        this.applyFilters();
        this.productsLoading = false;
      },
      error: () => {
        this.error =
          "Could not load products. Please check that the API is running.";
        this.productsLoading = false;
      },
    });
  }

  applyFilters(): void {
    let list = [...this.products];

    if (this.activeCategory !== "ALL") {
      const term = this.activeCategory.toLowerCase();

      list = list.filter((p) => {
        const category = p.category?.name || "";
        return (
          category.toLowerCase() === term
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

  get cartCount(): number {
    return this.api.cartSnapshot().reduce((sum, item) => sum + item.quantity, 0);
  }

  checkout(): void {
    this.router.navigateByUrl("/cart");
  }

  image(p: Product): string {
    const images = p.images ?? [];
    const selectedIndex = this.selectedImage[p.id] ?? 0;
    const url = images[selectedIndex]?.url || images[0]?.url;

    if (url && !url.includes("placehold.co")) {
      return url;
    }

    return this.fallback;
  }

  imageCount(p: Product): number {
    return p.images?.length ?? 0;
  }

  selectImage(product: Product, index: number): void {
    const imageCount = this.imageCount(product);
    if (index < 0 || index >= imageCount) return;
    this.selectedImage[product.id] = index;
  }

  startImageSwipe(event: TouchEvent, product: Product): void {
    if (!event.touches.length || this.imageCount(product) < 2) return;
    const touch = event.touches[0];
    this.imageSwipeStart = {
      productId: product.id,
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  endImageSwipe(event: TouchEvent, product: Product): void {
    const start = this.imageSwipeStart;
    this.imageSwipeStart = null;
    const touch = event.changedTouches[0];
    if (!start || start.productId !== product.id || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
      return;
    }

    const imageCount = this.imageCount(product);
    const current = this.selectedImage[product.id] ?? 0;
    this.selectImage(
      product,
      (current + (deltaX < 0 ? 1 : -1) + imageCount) % imageCount,
    );
    this.suppressedCardClickId = product.id;
    this.suppressedCardClickUntil = Date.now() + 500;
  }

  cancelImageSwipe(): void {
    this.imageSwipeStart = null;
  }

  onProductCardClick(product: Product): void {
    if (
      this.suppressedCardClickId === product.id &&
      Date.now() <= this.suppressedCardClickUntil
    ) {
      this.suppressedCardClickId = null;
      this.suppressedCardClickUntil = 0;
      return;
    }
    this.openProduct(product);
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

  badge(product: Product): string {
    if (!product.variants?.some((variant) => variant.stock > 0)) {
      return "OUT OF STOCK";
    }
    if (product.compareAt && product.compareAt > product.price) return "SALE";
    if (product.createdAt) {
      const age = Date.now() - new Date(product.createdAt).getTime();
      if (age >= 0 && age < 30 * 24 * 60 * 60 * 1000) return "NEW";
    }
    return "";
  }
}
