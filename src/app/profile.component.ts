
import { Component, inject, OnInit } from '@angular/core';
import {
  NgIf,
  NgFor,
  CurrencyPipe,
  DatePipe,
  UpperCasePipe
} from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, NgFor, CurrencyPipe, DatePipe, UpperCasePipe, RouterLink],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  api = inject(ApiService);

  user: any = null;
  orders: any[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.user = this.api.user$.value;

    if (!this.user) {
      this.loading = false;
      this.error = 'Please login to view your profile.';
      return;
    }

    this.api.myOrders().subscribe({
      next: (orders) => {
        this.orders = orders || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load your orders.';
        this.loading = false;
      }
    });
  }

  get initials(): string {
    return (this.user?.name || 'R')
      .trim()
      .charAt(0)
      .toUpperCase();
  }

  get deliveredCount(): number {
    return this.orders.filter(
      o => o.status?.toLowerCase() === 'delivered'
    ).length;
  }

  get pendingCount(): number {
    return this.orders.filter(
      o => !['delivered', 'cancelled'].includes(
        o.status?.toLowerCase()
      )
    ).length;
  }

  get totalSpent(): number {
    return this.orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );
  }

  logout(): void {
    this.api.logout();
  }
}
