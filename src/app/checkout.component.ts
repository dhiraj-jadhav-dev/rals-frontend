import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgIf } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ApiService } from "./api.service";
declare global {
  interface Window {
    Cashfree?: any;
  }
}
@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: "./checkout.component.html",
})
export class CheckoutComponent implements OnInit {
  api = inject(ApiService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  address: any = {
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  };
  paymentMethod = "CASHFREE";
  busy = false;
  error = "";
  message = "";
  isResult = false;
  ngOnInit() {
    const orderId = this.route.snapshot.queryParamMap.get("order_id");
    if (orderId) {
      this.isResult = true;
      this.message = "Checking payment status…";
      this.api
        .verifyCashfree(orderId)
        .subscribe({
          next: (r) =>
            (this.message = r.paid
              ? "Payment successful! Your order is confirmed."
              : "Payment not confirmed yet. Please contact support if money was debited."),
          error: () =>
            (this.message =
              "Could not verify payment. Please contact support."),
        });
    }
  }
  placeOrder() {
    const user = this.api.user$.value;
    if (!user) {
      this.router.navigateByUrl("/login");
      return;
    }
    const items = this.api.cartSnapshot();
    if (!items.length) {
      this.error = "Your bag is empty.";
      return;
    }
    this.busy = true;
    this.error = "";
    this.api
      .createOrder({
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        shippingAddress: this.address,
        paymentMethod: this.paymentMethod,
      })
      .subscribe({
        next: (order) => {
          this.api.clearCart();
          if (this.paymentMethod === "COD") {
            this.busy = false;
            this.message = `Order ${order.orderNumber} placed. Pay cash on delivery.`;
            return;
          }
          this.api.createCashfreeSession(order.id).subscribe({
            next: (s) => {
              this.busy = false;
              this.launchCashfree(s.paymentSessionId);
            },
            error: (e) => {
              this.busy = false;
              this.error =
                e.error?.message ||
                "Unable to start payment. Contact support before retrying.";
            },
          });
        },
        error: (e) => {
          this.busy = false;
          this.error = e.error?.message || "Unable to place order";
        },
      });
  }
  launchCashfree(sessionId: string) {
    if (!window.Cashfree) {
      this.error =
        "Cashfree checkout SDK is unavailable. Add the official Cashfree JS SDK before testing.";
      return;
    }
    const cashfree = window.Cashfree({ mode: "sandbox" });
    cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_self" });
  }
}
