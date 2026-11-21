import { FastifyInstance } from "fastify";
import { ContainerStore, PortMapping } from "./container.js";

export function registerRoutes(
  app: FastifyInstance,
  store: ContainerStore,
): void {
  app.get("/health", async () => ({
    success: true,
    data: { status: "ok" },
    error: null,
  }));

  // Images
  app.post("/images", async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const name = b?.name as string | undefined;
    if (!name || typeof name !== "string") {
      return reply
        .status(400)
        .send({ success: false, data: null, error: "name is required" });
    }
    const tag = (b?.tag as string | undefined) ?? "latest";
    const img = store.pullImage(name, tag);
    return reply.status(201).send({ success: true, data: img, error: null });
  });

  app.get("/images", async () => ({
    success: true,
    data: store.listImages(),
    error: null,
  }));

  app.get("/images/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const img = store.getImage(id);
    if (!img)
      return reply
        .status(404)
        .send({ success: false, data: null, error: "image not found" });
    return { success: true, data: img, error: null };
  });

  app.delete("/images/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!store.removeImage(id)) {
      return reply
        .status(404)
        .send({ success: false, data: null, error: "image not found" });
    }
    return { success: true, data: { id, removed: true }, error: null };
  });

  // Containers
  app.post("/containers", async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const imageId = b?.imageId as string | undefined;
    const name = b?.name as string | undefined;
    if (!imageId || typeof imageId !== "string") {
      return reply
        .status(400)
        .send({ success: false, data: null, error: "imageId is required" });
    }
    if (!name || typeof name !== "string") {
      return reply
        .status(400)
        .send({ success: false, data: null, error: "name is required" });
    }
    const command = Array.isArray(b?.command) ? (b.command as string[]) : [];
    const env =
      b?.env && typeof b.env === "object" && !Array.isArray(b.env)
        ? (b.env as Record<string, string>)
        : {};
    const ports = Array.isArray(b?.ports) ? (b.ports as PortMapping[]) : [];
    const res = store.createContainer(imageId, name, command, env, ports);
    if (!res.imageFound) {
      return reply
        .status(404)
        .send({ success: false, data: null, error: "image not found" });
    }
    if (res.nameConflict) {
      return reply
        .status(409)
        .send({
          success: false,
          data: null,
          error: "container name already exists",
        });
    }
    return reply
      .status(201)
      .send({ success: true, data: res.container, error: null });
  });

  app.get("/containers", async () => ({
    success: true,
    data: store.listContainers(),
    error: null,
  }));

  app.get("/containers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = store.getContainer(id);
    if (!c)
      return reply
        .status(404)
        .send({ success: false, data: null, error: "container not found" });
    return { success: true, data: c, error: null };
  });

  app.delete("/containers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!store.removeContainer(id)) {
      return reply
        .status(404)
        .send({ success: false, data: null, error: "container not found" });
    }
    return { success: true, data: { id, removed: true }, error: null };
  });

  app.post("/containers/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = store.startContainer(id);
    if (!res.found)
      return reply
        .status(404)
        .send({ success: false, data: null, error: "container not found" });
    if (res.alreadyRunning)
      return reply
        .status(409)
        .send({
          success: false,
          data: null,
          error: "container already running",
        });
    return { success: true, data: res.container, error: null };
  });

  app.post("/containers/:id/stop", async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = store.stopContainer(id);
    if (!res.found)
      return reply
        .status(404)
        .send({ success: false, data: null, error: "container not found" });
    if (res.notRunning)
      return reply
        .status(409)
        .send({ success: false, data: null, error: "container not running" });
    return { success: true, data: res.container, error: null };
  });

  app.get("/containers/:id/logs", async (req, reply) => {
    const { id } = req.params as { id: string };
    const logs = store.getLogs(id);
    if (!logs)
      return reply
        .status(404)
        .send({ success: false, data: null, error: "container not found" });
    return { success: true, data: { logs }, error: null };
  });
}
