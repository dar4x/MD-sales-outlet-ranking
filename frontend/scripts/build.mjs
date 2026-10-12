import { build } from 'vite';

// The shared root .env uses development for the backend.
process.env.NODE_ENV = 'production';
await build();
