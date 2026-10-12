import { preview } from 'vite';

// Match the production build despite the backend's shared development env.
process.env.NODE_ENV = 'production';
const server = await preview();
server.printUrls();
