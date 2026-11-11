import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgIf } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ApiService } from "./api.service";
@Component({
  selector: "app-login",
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  templateUrl: "./login.component.html",
})
export class LoginComponent {
  api = inject(ApiService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  mode: "login" | "register" = "login";
  name = "";
  email = "";
  password = "";
  phone = "";
  error = "";

  submit() {
    const req =
      this.mode === "login"
        ? this.api.login(this.email, this.password)
        : this.api.register(this.name, this.email, this.password, this.phone);
    req.subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get("returnUrl");
        const destination =
          returnUrl?.startsWith("/") && !returnUrl.startsWith("//")
            ? returnUrl
            : "/";
        void this.router.navigateByUrl(destination);
      },
      error: (e) => (this.error = e.error?.message || "Unable to sign in"),
    });
  }
}
