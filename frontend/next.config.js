const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No proxy needed — NEXT_PUBLIC_API_URL points directly to backend
  // CORS is handled on the Express backend
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
