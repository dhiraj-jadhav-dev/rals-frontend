import { Component, inject, OnInit } from "@angular/core";
import { NgFor, NgIf, CurrencyPipe, DatePipe } from "@angular/common";
import { ApiService } from "./api.service";
import { RouterLink } from "@angular/router";
@Component({
  selector: "app-orders",
  standalone: true,
  imports: [NgFor, NgIf, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: "./orders.component.html",
})
export class OrdersComponent implements OnInit {
  api = inject(ApiService);
  orders: any[] = [];
  error = "";

  ngOnInit() {
    this.api.myOrders().subscribe({
      next: (o) => (this.orders = o),
      error: () => (this.error = "Please login to view your orders."),
    });
  }
}
