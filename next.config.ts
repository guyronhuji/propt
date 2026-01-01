import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/api/:path*",
        destination: isDev
          ? "http://127.0.0.1:8000/api/:path*" // Local Python server
          : "/api/index.py", // Vercel Serverless Function
      },
    ];
  },
};

export default nextConfig;
