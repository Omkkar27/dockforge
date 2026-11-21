import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { ContainerStore } from "./container.js";
import type { PortMapping } from "./container.js";

type IdParams = {
  id: string;
};

type ImageBody = {
  name?: string;
  tag?: string;
};

type ContainerBody = {
  imageId?: string;
  name?: string;
  command?: string[];
  env?: Record<string, string>;
  ports?: PortMapping[];
};

export function registerRoutes(
  app: FastifyInstance,
  store: ContainerStore,
): void {
  // Health check
  app.get("/health", async () => {
    return {
      success: true,
      data: { status: "ok" },
      error: null,
    };
  });

  // Create image
  app.post(
    "/images",
    async (req: FastifyRequest<{ Body: ImageBody }>, reply: FastifyReply) => {
      const { name, tag = "latest" } = req.body ?? {};

      if (typeof name !== "string" || !name.trim()) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: "name is required",
        });
      }

      const image = store.pullImage(name, tag);

      return reply.status(201).send({
        success: true,
        data: image,
        error: null,
      });
    },
  );

  // List images
  app.get("/images", async () => {
    return {
      success: true,
      data: store.listImages(),
      error: null,
    };
  });

  // Get image by ID
  app.get(
    "/images/:id",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;
      const image = store.getImage(id);

      if (!image) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "image not found",
        });
      }

      return {
        success: true,
        data: image,
        error: null,
      };
    },
  );

  // Remove image
  app.delete(
    "/images/:id",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;

      if (!store.removeImage(id)) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "image not found",
        });
      }

      return {
        success: true,
        data: { id, removed: true },
        error: null,
      };
    },
  );

  // Create container
  app.post(
    "/containers",
    async (
      req: FastifyRequest<{ Body: ContainerBody }>,
      reply: FastifyReply,
    ) => {
      const {
        imageId,
        name,
        command = [],
        env = {},
        ports = [],
      } = req.body ?? {};

      if (typeof imageId !== "string" || !imageId.trim()) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: "imageId is required",
        });
      }

      if (typeof name !== "string" || !name.trim()) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: "name is required",
        });
      }

      const result = store.createContainer(imageId, name, command, env, ports);

      if (!result.imageFound) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "image not found",
        });
      }

      if (result.nameConflict) {
        return reply.status(409).send({
          success: false,
          data: null,
          error: "container name already exists",
        });
      }

      return reply.status(201).send({
        success: true,
        data: result.container,
        error: null,
      });
    },
  );

  // List containers
  app.get("/containers", async () => {
    return {
      success: true,
      data: store.listContainers(),
      error: null,
    };
  });

  // Get container by ID
  app.get(
    "/containers/:id",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;
      const container = store.getContainer(id);

      if (!container) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "container not found",
        });
      }

      return {
        success: true,
        data: container,
        error: null,
      };
    },
  );

  // Remove container
  app.delete(
    "/containers/:id",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;

      if (!store.removeContainer(id)) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "container not found",
        });
      }

      return {
        success: true,
        data: { id, removed: true },
        error: null,
      };
    },
  );

  // Start container
  app.post(
    "/containers/:id/start",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;
      const result = store.startContainer(id);

      if (!result.found) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "container not found",
        });
      }

      if (result.alreadyRunning) {
        return reply.status(409).send({
          success: false,
          data: null,
          error: "container already running",
        });
      }

      return {
        success: true,
        data: result.container,
        error: null,
      };
    },
  );

  // Stop container
  app.post(
    "/containers/:id/stop",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;
      const result = store.stopContainer(id);

      if (!result.found) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "container not found",
        });
      }

      if (result.notRunning) {
        return reply.status(409).send({
          success: false,
          data: null,
          error: "container not running",
        });
      }

      return {
        success: true,
        data: result.container,
        error: null,
      };
    },
  );

  // Get container logs
  app.get(
    "/containers/:id/logs",
    async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const { id } = req.params;
      const logs = store.getLogs(id);

      if (!logs) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: "container not found",
        });
      }

      return {
        success: true,
        data: { logs },
        error: null,
      };
    },
  );
}
