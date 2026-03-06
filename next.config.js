/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle in .next/standalone/
  // — no node_modules needed on the Pi
  output: 'standalone',
}

module.exports = nextConfig
