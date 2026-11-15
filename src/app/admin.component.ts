import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  ApiService,
  HeroBanner,
  HeroBannerMutation,
  Product,
  ProductImage,
  ProductMutation,
  UploadedProductImage,
  Variant,
} from "./api.service";

interface ProductDraft {
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
}

interface VariantDraft {
  size: string;
  color: string;
  stock: number;
}

interface PendingImage {
  file: File;
  preview: string;
}

type HeroImageTarget = "desktop" | "mobile";
type AdminTab = "overview" | "hero-banner" | "products" | "orders" | "inventory";

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
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe],
  templateUrl: "./admin.component.html",
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  activeTab: AdminTab = "overview";
  orders: any[] = [];
  products: Product[] = [];
  loadingProducts = false;
  saving = false;
  deletingProductId: string | null = null;
  deletingImageId: string | null = null;
  uploading = false;
  heroSaving = false;
  inventorySavingProductId: string | null = null;
  addingVariantProductId: string | null = null;
  message = "";
  error = "";
  editingProductId: string | null = null;
  editingProduct: Product | null = null;
  editingImages: ProductImage[] = [];
  pendingImages: PendingImage[] = [];
  inventoryStock: Record<string, number> = {};
  newVariants: Record<string, VariantDraft> = {};
  newProductVariants: VariantDraft[] = [this.emptyVariant()];
  product: ProductDraft = this.emptyProduct();
  heroBanner: HeroBanner = { ...DEFAULT_HERO_BANNER };
  heroBannerExists = false;
  desktopHeroFile: File | null = null;
  mobileHeroFile: File | null = null;
  desktopHeroPreview: string | null = null;
  mobileHeroPreview: string | null = null;
  removeDesktopImage = false;
  removeMobileImage = false;

  get activeTabTitle(): string {
    switch (this.activeTab) {
      case "hero-banner":
        return "HERO BANNER";
      case "products":
        return "PRODUCTS";
      case "orders":
        return "ORDERS";
      case "inventory":
        return "INVENTORY";
      default:
        return "OVERVIEW";
    }
  }

  ngOnInit(): void {
    this.load();
    this.loadHeroBanner();
  }

  ngOnDestroy(): void {
    this.clearPendingImages();
    this.clearHeroPreviews();
  }

  load(): void {
    this.loadProducts();
    this.loadOrders();
  }

  loadHeroBanner(): void {
    this.api.adminGetHeroBanner().subscribe({
      next: (banner) => {
        this.heroBanner = banner ?? { ...DEFAULT_HERO_BANNER };
        this.heroBannerExists = Boolean(banner);
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.errorMessage(error, "Could not load hero banner settings.");
      },
    });
  }

  onHeroImageSelected(event: Event, target: HeroImageTarget): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      this.error = "Choose a JPG, PNG or WEBP hero image.";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = `${file.name} is larger than 5 MB.`;
      return;
    }

    this.error = "";
    this.message = "";
    if (target === "desktop") {
      if (this.desktopHeroPreview) URL.revokeObjectURL(this.desktopHeroPreview);
      this.desktopHeroFile = file;
      this.desktopHeroPreview = URL.createObjectURL(file);
      this.removeDesktopImage = false;
    } else {
      if (this.mobileHeroPreview) URL.revokeObjectURL(this.mobileHeroPreview);
      this.mobileHeroFile = file;
      this.mobileHeroPreview = URL.createObjectURL(file);
      this.removeMobileImage = false;
    }
  }

  removeHeroImage(target: HeroImageTarget): void {
    if (target === "desktop") {
      if (this.desktopHeroPreview) URL.revokeObjectURL(this.desktopHeroPreview);
      this.desktopHeroPreview = null;
      this.desktopHeroFile = null;
      this.removeDesktopImage = Boolean(this.heroBanner.desktopImageUrl);
    } else {
      if (this.mobileHeroPreview) URL.revokeObjectURL(this.mobileHeroPreview);
      this.mobileHeroPreview = null;
      this.mobileHeroFile = null;
      this.removeMobileImage = Boolean(this.heroBanner.mobileImageUrl);
    }
  }

  heroImagePreview(target: HeroImageTarget): string {
    if (target === "desktop") {
      return (
        this.desktopHeroPreview ||
        (!this.removeDesktopImage && this.heroBanner.desktopImageUrl) ||
        "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=1200&q=85"
      );
    }
    return (
      this.mobileHeroPreview ||
      (!this.removeMobileImage && this.heroBanner.mobileImageUrl) ||
      this.desktopHeroPreview ||
      (!this.removeDesktopImage && this.heroBanner.desktopImageUrl) ||
      "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=85"
    );
  }

  saveHeroBanner(): void {
    if (this.heroSaving) return;
    this.heroSaving = true;
    this.error = "";
    this.message = "";
    const payload: HeroBannerMutation = {
      eyebrow: this.heroBanner.eyebrow,
      heading: this.heroBanner.heading,
      headingAccent: this.heroBanner.headingAccent,
      subtitle: this.heroBanner.subtitle,
      buttonText: this.heroBanner.buttonText,
      buttonLink: this.heroBanner.buttonLink,
      active: this.heroBanner.active,
      removeDesktopImage: this.removeDesktopImage,
      removeMobileImage: this.removeMobileImage,
    };

    const saveRequest = this.heroBannerExists
      ? this.api.adminUpdateHeroBanner(
          payload,
          this.desktopHeroFile ?? undefined,
          this.mobileHeroFile ?? undefined,
        )
      : this.api.adminCreateHeroBanner(
          payload,
          this.desktopHeroFile ?? undefined,
          this.mobileHeroFile ?? undefined,
        );
    saveRequest
      .subscribe({
        next: (banner) => {
          this.heroBanner = banner;
          this.heroBannerExists = true;
          this.clearHeroPreviews();
          this.heroSaving = false;
          this.message = "Home hero banner published.";
        },
        error: (error: HttpErrorResponse) => {
          this.heroSaving = false;
          this.error = this.errorMessage(error, "Unable to update hero banner.");
        },
      });
  }

  deleteHeroBanner(): void {
    if (
      !this.heroBannerExists ||
      !window.confirm("Delete the homepage hero banner and its Cloudinary images?")
    ) {
      return;
    }
    this.heroSaving = true;
    this.error = "";
    this.message = "";
    this.api.adminDeleteHeroBanner().subscribe({
      next: () => {
        this.heroBannerExists = false;
        this.heroBanner = { ...DEFAULT_HERO_BANNER };
        this.clearHeroPreviews();
        this.heroSaving = false;
        this.message = "Hero banner and its images were deleted.";
      },
      error: (error: HttpErrorResponse) => {
        this.heroSaving = false;
        this.error = this.errorMessage(error, "Unable to delete hero banner.");
      },
    });
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.api.adminProducts().subscribe({
      next: (items) => {
        this.products = items ?? [];
        for (const product of this.products) {
          for (const variant of product.variants) {
            this.inventoryStock[variant.id] = variant.stock;
          }
          this.newVariants[product.id] ??= this.emptyVariant();
        }
        this.editingProduct = this.editingProductId
          ? this.products.find((product) => product.id === this.editingProductId) ??
            null
          : null;
        this.loadingProducts = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loadingProducts = false;
        this.error = this.errorMessage(error, "Could not load products.");
      },
    });
  }

  loadOrders(): void {
    this.api.adminOrders().subscribe({
      next: (items: any[]) => (this.orders = items ?? []),
      error: (error: HttpErrorResponse) =>
        (this.error = this.errorMessage(
          error,
          "Could not load orders. Sign in with an ADMIN account.",
        )),
    });
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    this.error = "";

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        this.error = "Choose JPG, PNG or WEBP images.";
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.error = `${file.name} is larger than 5 MB.`;
        continue;
      }
      this.pendingImages.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }
    input.value = "";
  }

  removePendingImage(index: number): void {
    const [image] = this.pendingImages.splice(index, 1);
    if (image) URL.revokeObjectURL(image.preview);
  }

  removeExistingImage(image: ProductImage): void {
    if (!this.editingProductId || this.deletingImageId) return;
    if (!window.confirm("Delete this image from the product?")) return;

    this.error = "";
    this.message = "";
    this.deletingImageId = image.id;
    this.api
      .adminDeleteProductImage(this.editingProductId, image.id)
      .subscribe({
        next: () => {
          this.editingImages = this.editingImages.filter(
            (item) => item.id !== image.id,
          );
          this.deletingImageId = null;
          this.message = "Product image deleted.";
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.deletingImageId = null;
          this.error = this.errorMessage(error, "Unable to delete image.");
        },
      });
  }

  addProduct(): void {
    this.message = "";
    this.error = "";
    if (
      !this.product.name.trim() ||
      !this.product.slug.trim() ||
      !Number.isFinite(Number(this.product.price)) ||
      Number(this.product.price) <= 0
    ) {
      this.error = "Enter product name, slug and a price greater than zero.";
      return;
    }
    if (!this.editingProductId && !this.validNewProductVariants()) {
      this.error = "Add at least one size, color and non-negative stock value.";
      return;
    }
    if (this.saving) return;

    this.saving = true;
    const files = this.pendingImages.map((item) => item.file);
    this.uploading = files.length > 0;
    if (files.length) {
      this.api.uploadProductImages(files).subscribe({
        next: ({ images }) => {
          this.uploading = false;
          this.persistProduct(images);
        },
        error: (error: HttpErrorResponse) => {
          this.saving = false;
          this.uploading = false;
          this.error = this.errorMessage(error, "Image upload failed.");
        },
      });
    } else {
      this.persistProduct([]);
    }
  }

  startEdit(product: Product): void {
    this.editingProductId = product.id;
    this.editingProduct = product;
    this.editingImages = [...product.images].sort(
      (a, b) => a.position - b.position,
    );
    this.product = {
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price / 100,
      category: product.category?.name ?? "",
    };
    this.message = "";
    this.error = "";
    this.clearPendingImages();
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  }

  cancelEdit(): void {
    this.editingProductId = null;
    this.editingProduct = null;
    this.editingImages = [];
    this.product = this.emptyProduct();
    this.newProductVariants = [this.emptyVariant()];
    this.clearPendingImages();
  }

  addNewProductVariant(): void {
    this.newProductVariants.push(this.emptyVariant());
  }

  removeNewProductVariant(index: number): void {
    if (this.newProductVariants.length > 1) {
      this.newProductVariants.splice(index, 1);
    }
  }

  addInventoryVariant(product: Product): void {
    const draft = this.newVariants[product.id] ?? this.emptyVariant();
    const size = draft.size.trim().toUpperCase();
    const color = draft.color.trim();
    if (!size || !color || !Number.isInteger(Number(draft.stock)) || draft.stock < 0) {
      this.error = "Enter a size, color and non-negative whole-number stock.";
      return;
    }
    const duplicate = product.variants.some(
      (variant) =>
        variant.size.trim().toUpperCase() === size &&
        variant.color.trim().toLowerCase() === color.toLowerCase(),
    );
    if (duplicate) {
      this.error = "That size and color variant already exists.";
      return;
    }

    this.error = "";
    this.message = "";
    this.addingVariantProductId = product.id;
    this.api
      .adminAddVariant(product.id, {
        sku: this.createSku(product.name, size, color),
        size,
        color,
        stock: Number(draft.stock),
      })
      .subscribe({
        next: () => {
          this.addingVariantProductId = null;
          this.newVariants[product.id] = this.emptyVariant();
          this.message = `Variant added to ${product.name}.`;
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.addingVariantProductId = null;
          this.error = this.errorMessage(error, "Unable to add size variant.");
        },
      });
  }

  saveInventory(product: Product): void {
    const updates = product.variants.filter(
      (variant) => Number(this.inventoryStock[variant.id]) !== variant.stock,
    );
    if (!updates.length) {
      this.message = "Inventory is already up to date.";
      return;
    }
    if (
      updates.some(
        (variant) =>
          !Number.isInteger(Number(this.inventoryStock[variant.id])) ||
          Number(this.inventoryStock[variant.id]) < 0,
      )
    ) {
      this.error = "Stock must be a non-negative whole number.";
      return;
    }

    this.error = "";
    this.message = "";
    this.inventorySavingProductId = product.id;
    forkJoin(
      updates.map((variant) =>
        this.api.adminUpdateVariantStock(
          variant.id,
          Number(this.inventoryStock[variant.id]),
        ),
      ),
    ).subscribe({
      next: () => {
        this.inventorySavingProductId = null;
        this.message = `Inventory updated for ${product.name}.`;
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.inventorySavingProductId = null;
        this.error = this.errorMessage(error, "Unable to update inventory.");
      },
    });
  }

  removeVariant(variant: Variant): void {
    if (!window.confirm(`Remove ${variant.size} / ${variant.color}?`)) return;
    this.error = "";
    this.message = "";
    this.api.adminDeleteVariant(variant.id).subscribe({
      next: () => {
        this.message = `${variant.size} / ${variant.color} variant removed.`;
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.errorMessage(error, "Unable to remove variant.");
      },
    });
  }

  deleteProduct(product: Product): void {
    if (
      this.deletingProductId ||
      !window.confirm(`Delete "${product.name}" from the catalogue?`)
    ) {
      return;
    }

    this.message = "";
    this.error = "";
    this.deletingProductId = product.id;
    this.api.adminDeleteProduct(product.id).subscribe({
      next: () => {
        this.deletingProductId = null;
        this.message = `${product.name} was deleted.`;
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.deletingProductId = null;
        this.error = this.errorMessage(error, "Unable to delete product.");
      },
    });
  }

  updateOrder(id: string, status: string): void {
    this.api.adminUpdateOrder(id, status).subscribe({
      next: () => {
        this.message = "Order status updated.";
        this.loadOrders();
      },
      error: (error: HttpErrorResponse) =>
        (this.error = this.errorMessage(error, "Unable to update order.")),
    });
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  private persistProduct(images: UploadedProductImage[]): void {
    const payload: ProductMutation = {
      ...this.product,
      name: this.product.name.trim(),
      slug: this.product.slug.trim(),
      description: this.product.description.trim(),
      category: this.product.category.trim(),
      price: Math.round(Number(this.product.price) * 100),
    };

    if (this.editingProductId) {
      const productId = this.editingProductId;
      this.api.adminUpdateProduct(productId, payload).subscribe({
        next: () => {
          if (images.length) {
            this.api
              .adminAddProductImages(productId, this.persistableImages(images))
              .subscribe({
                next: () => this.finishProductSave("Product updated successfully."),
                error: (error: HttpErrorResponse) =>
                  this.failProductSave(error, "Unable to add product images."),
              });
          } else {
            this.finishProductSave("Product updated successfully.");
          }
        },
        error: (error: HttpErrorResponse) =>
          this.failProductSave(error, "Unable to update product."),
      });
      return;
    }

    payload.images = this.persistableImages(images);
    payload.variants = this.newProductVariants.map((variant, index) => ({
      sku: this.createSku(this.product.name, variant.size, variant.color, index),
      size: variant.size.trim().toUpperCase(),
      color: variant.color.trim(),
      stock: Number(variant.stock),
    }));
    this.api.adminCreateProduct(payload).subscribe({
      next: () => this.finishProductSave("Product created successfully."),
      error: (error: HttpErrorResponse) =>
        this.failProductSave(error, "Unable to create product."),
    });
  }

  private finishProductSave(message: string): void {
    this.saving = false;
    this.message = message;
    this.cancelEdit();
    this.loadProducts();
  }

  private failProductSave(error: HttpErrorResponse, fallback: string): void {
    this.saving = false;
    this.uploading = false;
    this.error = this.errorMessage(error, fallback);
  }

  private persistableImages(images: UploadedProductImage[]) {
    return images.map(({ url, publicId }) => ({ url, publicId }));
  }

  private validNewProductVariants(): boolean {
    if (!this.newProductVariants.length) return false;
    const seen = new Set<string>();
    for (const variant of this.newProductVariants) {
      const size = variant.size.trim().toUpperCase();
      const color = variant.color.trim();
      if (
        !size ||
        !color ||
        !Number.isInteger(Number(variant.stock)) ||
        variant.stock < 0
      ) {
        return false;
      }
      const key = `${color.toLowerCase()}|${size}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }

  private createSku(
    productName: string,
    size: string,
    color: string,
    index = 0,
  ): string {
    const productCode = productName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 12);
    const colorCode = color
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8);
    return `RALS-${productCode}-${size}-${colorCode}-${Date.now()}-${index}`;
  }

  private clearPendingImages(): void {
    for (const image of this.pendingImages) URL.revokeObjectURL(image.preview);
    this.pendingImages = [];
  }

  private clearHeroPreviews(): void {
    if (this.desktopHeroPreview) URL.revokeObjectURL(this.desktopHeroPreview);
    if (this.mobileHeroPreview) URL.revokeObjectURL(this.mobileHeroPreview);
    this.desktopHeroPreview = null;
    this.mobileHeroPreview = null;
    this.desktopHeroFile = null;
    this.mobileHeroFile = null;
    this.removeDesktopImage = false;
    this.removeMobileImage = false;
  }

  private emptyProduct(): ProductDraft {
    return { name: "", slug: "", description: "", price: 0, category: "" };
  }

  private emptyVariant(): VariantDraft {
    return { size: "", color: "", stock: 0 };
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(", ") : message || fallback;
  }
}
