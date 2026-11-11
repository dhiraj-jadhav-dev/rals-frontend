import { HttpInterceptorFn } from "@angular/common/http";
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isPublicProductRead =
    req.method === "GET" &&
    /\/(?:api\/)?products(?:\/[^/]+)?\/?$/.test(
      new URL(req.url, window.location.origin).pathname,
    );

  if (isPublicProductRead) {
    return next(req.clone({ headers: req.headers.delete("Authorization") }));
  }

  const token = localStorage.getItem("rals_token");
  return next(
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req,
  );
};
