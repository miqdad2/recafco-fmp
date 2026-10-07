import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // FMP-TASK-05 - Create Task uploads files (up to 25 MB each) through a
  // server action; the 1 MB default would reject them.
  experimental: {
    serverActions: { bodySizeLimit: '30mb' },
  },
};

export default config;
