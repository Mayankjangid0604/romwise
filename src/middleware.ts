export { auth as middleware } from "@/lib/auth-edge";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
    "/api/discovery",
    "/api/group-alignment",
  ],
};
