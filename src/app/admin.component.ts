import { Component, inject, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApiService } from "./api.service";

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe],
  templateUrl: "./admin.component.html"
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  orders: any[] = [];
  products: any[] = [];
  loadingProducts = false;
  saving = false;
  deletingProductId: string | null = null;
  uploading = false;
  message = "";
  error = "";
  imageUrl = "";
  imagePreview = "";
  product = { name: "", slug: "", description: "", price: 0, category: "" };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadProducts();
    this.loadOrders();
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.api.adminProducts().subscribe({
      next: (items: any[]) => {
        this.products = items ?? [];
        this.loadingProducts = false;
      },
      error: (e: any) => {
        this.loadingProducts = false;
        this.error = e?.error?.message || "Could not load products.";
      },
    });
  }

  loadOrders(): void {
    this.api.adminOrders().subscribe({
      next: (items: any[]) => (this.orders = items ?? []),
      error: (e: any) =>
        (this.error =
          e?.error?.message ||
          "Could not load orders. Sign in with an ADMIN account."),
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      this.error = "Choose a JPG, PNG or WEBP image.";
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = "Image must be 5 MB or smaller.";
      input.value = "";
      return;
    }
    this.error = "";
    this.uploading = true;
    this.imagePreview = URL.createObjectURL(file);
    this.api.uploadProductImage(file).subscribe({
      next: (result: any) => {
        this.imageUrl = result.url;
        this.uploading = false;
        this.message = "Image uploaded.";
      },
      error: (e: any) => {
        this.uploading = false;
        this.imageUrl = "";
        this.error = e?.error?.message || "Image upload failed.";
      },
    });
  }

  addProduct(): void {
    this.message = "";
    this.error = "";
    if (
      !this.product.name.trim() ||
      !this.product.slug.trim() ||
      Number(this.product.price) <= 0
    ) {
      this.error = "Enter product name, slug and a price greater than zero.";
      return;
    }
    if (this.uploading) {
      this.error = "Wait for the image upload to finish.";
      return;
    }

    const payload = {
      ...this.product,
      price: Math.round(Number(this.product.price) * 100),
      images: this.imageUrl
        ? [{ url: this.imageUrl, alt: this.product.name }]
        : [],
      variants: [
        { sku: "RALS-" + Date.now(), size: "M", color: "Default", stock: 10 },
      ],
    };
    this.saving = true;
    this.api.adminCreateProduct(payload).subscribe({
      next: () => {
        this.saving = false;
        this.message = "Product created successfully.";
        this.product = {
          name: "",
          slug: "",
          description: "",
          price: 0,
          category: "",
        };
        this.imageUrl = "";
        this.imagePreview = "";
        this.loadProducts();
      },
      error: (e: any) => {
        this.saving = false;
        this.error = e?.error?.message || "Unable to create product.";
      },
    });
  }

  deleteProduct(product: any): void {
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
      error: (e: any) => {
        this.deletingProductId = null;
        this.error = e?.error?.message || "Unable to delete product.";
      },
    });
  }

  updateOrder(id: string, status: string): void {
    this.api.adminUpdateOrder(id, status).subscribe({
      next: () => {
        this.message = "Order status updated.";
        this.loadOrders();
      },
      error: (e: any) =>
        (this.error = e?.error?.message || "Unable to update order."),
    });
  }

  trackById(_: number, item: any): string {
    return item.id;
  }
}
