import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ApiService } from './api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AsyncPipe],
  templateUrl: './app.component.html'
})
export class AppComponent {
  api = inject(ApiService);
  cartCount = this.getCartCount();

  getCartCount(): number {
    try {
      const cart = JSON.parse(sessionStorage.getItem('rals_cart') || '[]');
      return cart.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    } catch { return 0; }
  }
}
