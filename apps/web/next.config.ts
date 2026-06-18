import type { NextConfig } from "next";

// For GitHub Pages project sites the app is served under /<repo>. The Actions workflow
// sets NEXT_PUBLIC_BASE_PATH to "/<repo>"; locally it is empty (served at /).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Fully static site (no server / API routes) for GitHub Pages.
  output: "export",
  basePath,
  trailingSlash: true,
  reactCompiler: true,
  images: { unoptimized: true },
};

export default nextConfig;
