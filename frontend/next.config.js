/** @type {import('next').NextConfig} */
const nextConfig = {
  // No proxy needed — NEXT_PUBLIC_API_URL points directly to backend
  // CORS is handled on the Express backend
};

module.exports = nextConfig;
