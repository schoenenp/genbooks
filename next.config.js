/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = { 
    images:{
    remotePatterns: [
        {
          protocol: 'https',
          hostname: 'cdn.pirrot.de',
          port: '',
          pathname: '/storage/**',
        },
        {
          protocol: 'https',
          hostname: 'cdn.pirrot.de',
          port: '',
          pathname: '/assets/**',
        },
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/id/**',
        },
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/seed/**',
        },
      ],
}};

export default config;
