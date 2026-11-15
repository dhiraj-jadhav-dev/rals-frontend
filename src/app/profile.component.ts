import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe, DatePipe, NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AddressMutation,
  ApiService,
  ProfileUpdate,
  SavedAddress,
  UserProfile,
} from './api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, NgFor, CurrencyPipe, DatePipe, UpperCasePipe, RouterLink, FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  api = inject(ApiService);

  user: UserProfile | null = null;
  orders: any[] = [];
  addresses: SavedAddress[] = [];
  loading = true;
  profileLoading = true;
  error = '';
  profileError = '';
  profileSuccess = '';
  addressError = '';
  addressSuccess = '';
  editingProfile = false;
  savingProfile = false;
  editingAddressId: string | null = null;
  savingAddress = false;
  deletingAddressId: string | null = null;
  pendingDeleteAddressId: string | null = null;

  profileForm: ProfileUpdate = { name: '', email: '', phone: '' };
  addressForm: AddressMutation = this.emptyAddress();

  ngOnInit(): void {
    this.user = this.api.user$.value;

    if (!this.user) {
      this.loading = false;
      this.profileLoading = false;
      this.error = 'Please login to view your profile.';
      return;
    }

    this.setProfileForm(this.user);
    this.api.getProfile().subscribe({
      next: (user) => {
        this.setUser(user);
        this.profileLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.profileError = this.errorMessage(
          error,
          'Unable to load your profile details.',
        );
        this.profileLoading = false;
      },
    });

    this.api.myOrders().subscribe({
      next: (orders) => {
        this.orders = orders || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load your orders.';
        this.loading = false;
      },
    });
  }

  get initials(): string {
    return (this.user?.name || 'R').trim().charAt(0).toUpperCase();
  }

  get deliveredCount(): number {
    return this.orders.filter(
      (order) => order.status?.toLowerCase() === 'delivered',
    ).length;
  }

  get pendingCount(): number {
    return this.orders.filter(
      (order) =>
        !['delivered', 'cancelled'].includes(order.status?.toLowerCase()),
    ).length;
  }

  get totalSpent(): number {
    return this.orders.reduce((sum, order) => sum + (order.total || 0), 0);
  }

  startProfileEdit(): void {
    if (!this.user) return;
    this.setProfileForm(this.user);
    this.profileError = '';
    this.profileSuccess = '';
    this.editingProfile = true;
  }

  cancelProfileEdit(): void {
    if (this.user) this.setProfileForm(this.user);
    this.editingProfile = false;
    this.profileError = '';
  }

  saveProfile(): void {
    if (this.savingProfile) return;
    this.savingProfile = true;
    this.profileError = '';
    this.profileSuccess = '';

    this.api.updateProfile({
      name: this.profileForm.name.trim(),
      email: this.profileForm.email.trim(),
      phone: this.profileForm.phone.trim(),
    }).subscribe({
      next: (user) => {
        this.setUser(user);
        this.editingProfile = false;
        this.profileSuccess = 'Your profile has been updated.';
        this.savingProfile = false;
      },
      error: (error: HttpErrorResponse) => {
        this.profileError = this.errorMessage(error, 'Unable to save your profile.');
        this.savingProfile = false;
      },
    });
  }

  startNewAddress(): void {
    this.editingAddressId = 'new';
    this.addressForm = {
      ...this.emptyAddress(),
      fullName: this.user?.name ?? '',
      phone: this.user?.phone ?? '',
    };
    this.addressError = '';
    this.addressSuccess = '';
    this.pendingDeleteAddressId = null;
  }

  editAddress(address: SavedAddress): void {
    this.editingAddressId = address.id;
    this.addressForm = {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
    };
    this.addressError = '';
    this.addressSuccess = '';
    this.pendingDeleteAddressId = null;
  }

  cancelAddressEdit(): void {
    this.editingAddressId = null;
    this.addressError = '';
  }

  saveAddress(): void {
    if (this.savingAddress || this.editingAddressId === null) return;
    this.savingAddress = true;
    this.addressError = '';
    this.addressSuccess = '';

    const payload: AddressMutation = {
      ...this.addressForm,
      fullName: this.addressForm.fullName.trim(),
      phone: this.addressForm.phone.trim(),
      line1: this.addressForm.line1.trim(),
      line2: this.addressForm.line2.trim(),
      city: this.addressForm.city.trim(),
      state: this.addressForm.state.trim(),
      postalCode: this.addressForm.postalCode.trim(),
      country: this.addressForm.country.trim(),
    };
    const isNew = this.editingAddressId === 'new';
    const request = isNew
      ? this.api.createSavedAddress(payload)
      : this.api.updateSavedAddress(this.editingAddressId, payload);

    request.subscribe({
      next: (address) => {
        this.addresses = [
          address,
          ...this.addresses.filter((item) => item.id !== address.id),
        ];
        this.updateCachedAddresses();
        this.editingAddressId = null;
        this.addressSuccess = isNew
          ? 'Address added.'
          : 'Address updated.';
        this.savingAddress = false;
      },
      error: (error: HttpErrorResponse) => {
        this.addressError = this.errorMessage(error, 'Unable to save this address.');
        this.savingAddress = false;
      },
    });
  }

  requestAddressDelete(addressId: string): void {
    this.pendingDeleteAddressId = addressId;
    this.addressError = '';
    this.addressSuccess = '';
  }

  cancelAddressDelete(): void {
    this.pendingDeleteAddressId = null;
  }

  confirmDeleteAddress(addressId: string): void {
    if (this.deletingAddressId) return;
    this.deletingAddressId = addressId;
    this.addressError = '';

    this.api.deleteSavedAddress(addressId).subscribe({
      next: () => {
        this.addresses = this.addresses.filter(
          (address) => address.id !== addressId,
        );
        this.updateCachedAddresses();
        this.pendingDeleteAddressId = null;
        this.deletingAddressId = null;
        this.addressSuccess = 'Address removed.';
      },
      error: (error: HttpErrorResponse) => {
        this.addressError = this.errorMessage(error, 'Unable to remove this address.');
        this.deletingAddressId = null;
      },
    });
  }

  logout(): void {
    this.api.logout();
  }

  private setUser(user: UserProfile): void {
    this.user = user;
    this.addresses = user.addresses ?? [];
    this.setProfileForm(user);
    this.api.updateCachedProfile(user);
  }

  private setProfileForm(user: UserProfile): void {
    this.profileForm = {
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
    };
  }

  private updateCachedAddresses(): void {
    if (!this.user) return;
    this.api.updateCachedProfile({ ...this.user, addresses: this.addresses });
  }

  private emptyAddress(): AddressMutation {
    return {
      fullName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    };
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    return typeof message === 'string' ? message : fallback;
  }
}
