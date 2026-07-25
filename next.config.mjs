// AC-1 (issue #15): enable Next.js standalone output so the production server
// is a minimal self-contained bundle (`.next/standalone`), which the Dockerfile
// copies into the final image. No other behavior change.
//
// Issue #17: sharp is a native module (libvips bindings). Telling Next.js to
// treat it as a server external package means the bundler won't try to trace/
// bundle its native .node files into the webpack output, which avoids both
// build-time segfaults on Windows and broken standalone bundles in Docker.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
