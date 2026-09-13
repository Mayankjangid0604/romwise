export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
    "/api/discovery",
    "/api/group-alignment",
  ],
};
