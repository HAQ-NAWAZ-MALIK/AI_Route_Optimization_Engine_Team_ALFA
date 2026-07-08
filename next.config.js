/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Enable standalone output for Docker deployment
    output: 'standalone',
    // Don't fail the production build on type errors.
    typescript: {
        ignoreBuildErrors: true,
    },
    // Don't fail the production build on lint errors.
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Enable experimental features if needed
    experimental: {
        // serverActions: true,
    },
    // Serve the static landing page at the root URL without redirecting.
    async rewrites() {
        return {
            beforeFiles: [
                { source: '/', destination: '/demo.html' },
            ],
        };
    },
};

module.exports = nextConfig;
