// AC-1 (issue #15): enable Next.js standalone output so the production server
// is a minimal self-contained bundle (`.next/standalone`), which the Dockerfile
// copies into the final image. No other behavior change.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
