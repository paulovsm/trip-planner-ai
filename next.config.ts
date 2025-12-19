import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ["pdf-parse", "mammoth", "firebase-admin", "@google-cloud/firestore", "google-gax"],
};

export default nextConfig;
