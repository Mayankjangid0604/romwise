import type { NextConfig } from "next";

// Environment Validation
if (process.env.NODE_ENV === "production") {
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Production startup failed: Missing required environment variables: ${missing.join(", ")}`);
  }
  
  if (!process.env.APP_URL) {
    throw new Error("Production startup failed: Missing a trusted base URL (APP_URL)");
  }

  // E2E VARIABLES MUST NEVER ENABLE IN PRODUCTION
  if (process.env.E2E_TEST_MODE === "true" || process.env.E2E_AI_MOCK === "true" || process.env.OTP_TEST_BYPASS === "true") {
    throw new Error("Production startup failed: E2E test modes are active. Unset E2E_TEST_MODE, E2E_AI_MOCK, and OTP_TEST_BYPASS.");
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
