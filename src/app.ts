import Fastify from 'fastify';
import { ContainerStore } from './container.js';
import { registerRoutes } from './routes.js';

export function buildApp() {
  const app = Fastify();
  const store = new ContainerStore();
  registerRoutes(app, store);
  return app;
}
