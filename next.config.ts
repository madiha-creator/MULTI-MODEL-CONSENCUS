import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Prompt 5/6 kept the tree typecheck-clean; re-enable so a type error
    // fails the build instead of shipping silently (Known Issue #1).
    ignoreBuildErrors: false,
  },
  eslint: {
    // Still ignored: the repo has no eslint.config.js (ESLint 9 needs the
    // flat config); adding one is separate cleanup.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
