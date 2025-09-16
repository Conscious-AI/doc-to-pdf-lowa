/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable WASM support
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM loader
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Handle ES modules in public directory
    config.module.rules.push({
      test: /\.js$/,
      include: /public/,
      type: 'javascript/esm',
    });

    // Don't process WASM files on server side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        './soffice.wasm': 'commonjs ./soffice.wasm',
      });
    }

    return config;
  },

  // Add headers for WASM and SharedArrayBuffer support
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },

  // Optimize for static files
  trailingSlash: false,
  
  // Disable image optimization for our use case
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
