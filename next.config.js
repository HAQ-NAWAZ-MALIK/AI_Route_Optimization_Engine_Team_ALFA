/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Enable standalone output for Docker deployment
    output: 'standalone',
    // Enable experimental features if needed
    experimental: {
        // serverActions: true,
    },
};

module.exports = nextConfig;
