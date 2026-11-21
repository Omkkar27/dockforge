import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";

function makeApp() {
  return buildApp();
}

async function pullImage(
  app: ReturnType<typeof makeApp>,
  name = "ubuntu",
  tag = "latest",
) {
  return app.inject({ method: "POST", url: "/images", payload: { name, tag } });
}

async function createContainer(
  app: ReturnType<typeof makeApp>,
  imageId: string,
  name = "myapp",
) {
  return app.inject({
    method: "POST",
    url: "/containers",
    payload: { imageId, name, command: ["/bin/sh"], env: {}, ports: [] },
  });
}

describe("container-runtime API", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => {
    app = makeApp();
  });

  it("GET /health returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  // Images
  it("POST /images pulls image", async () => {
    const res = await pullImage(app);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe("ubuntu");
    expect(body.data.tag).toBe("latest");
    expect(body.data.id).toBeTruthy();
  });

  it("POST /images missing name returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/images",
      payload: { tag: "latest" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /images defaults tag to latest", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/images",
      payload: { name: "nginx" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.tag).toBe("latest");
  });

  it("GET /images lists images", async () => {
    await pullImage(app, "ubuntu");
    await pullImage(app, "nginx");
    const res = await app.inject({ method: "GET", url: "/images" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("GET /images/:id returns image", async () => {
    const img = (await pullImage(app)).json();
    const res = await app.inject({
      method: "GET",
      url: `/images/${img.data.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("ubuntu");
  });

  it("GET /images/:id not found returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/images/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /images/:id removes image", async () => {
    const img = (await pullImage(app)).json();
    const res = await app.inject({
      method: "DELETE",
      url: `/images/${img.data.id}`,
    });
    expect(res.statusCode).toBe(200);
    const check = await app.inject({
      method: "GET",
      url: `/images/${img.data.id}`,
    });
    expect(check.statusCode).toBe(404);
  });

  it("DELETE /images/:id not found returns 404", async () => {
    const res = await app.inject({ method: "DELETE", url: "/images/nope" });
    expect(res.statusCode).toBe(404);
  });

  // Containers
  it("POST /containers creates container", async () => {
    const img = (await pullImage(app)).json();
    const res = await createContainer(app, img.data.id);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.status).toBe("created");
    expect(body.data.imageId).toBe(img.data.id);
  });

  it("POST /containers image not found returns 404", async () => {
    const res = await createContainer(app, "nope");
    expect(res.statusCode).toBe(404);
  });

  it("POST /containers missing imageId returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/containers",
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /containers missing name returns 400", async () => {
    const img = (await pullImage(app)).json();
    const res = await app.inject({
      method: "POST",
      url: "/containers",
      payload: { imageId: img.data.id },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /containers duplicate name returns 409", async () => {
    const img = (await pullImage(app)).json();
    await createContainer(app, img.data.id, "myapp");
    const res = await createContainer(app, img.data.id, "myapp");
    expect(res.statusCode).toBe(409);
  });

  it("GET /containers lists containers", async () => {
    const img = (await pullImage(app)).json();
    await createContainer(app, img.data.id, "c1");
    await createContainer(app, img.data.id, "c2");
    const res = await app.inject({ method: "GET", url: "/containers" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("GET /containers/:id returns container", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    const res = await app.inject({
      method: "GET",
      url: `/containers/${c.data.id}`,
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /containers/:id not found returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/containers/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /containers/:id removes container", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    const res = await app.inject({
      method: "DELETE",
      url: `/containers/${c.data.id}`,
    });
    expect(res.statusCode).toBe(200);
    const check = await app.inject({
      method: "GET",
      url: `/containers/${c.data.id}`,
    });
    expect(check.statusCode).toBe(404);
  });

  it("DELETE /containers/:id not found returns 404", async () => {
    const res = await app.inject({ method: "DELETE", url: "/containers/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /containers/:id/start starts container", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    const res = await app.inject({
      method: "POST",
      url: `/containers/${c.data.id}/start`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("running");
    expect(res.json().data.startedAt).toBeTruthy();
  });

  it("POST /containers/:id/start container not found returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/containers/nope/start",
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /containers/:id/start already running returns 409", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    await app.inject({ method: "POST", url: `/containers/${c.data.id}/start` });
    const res = await app.inject({
      method: "POST",
      url: `/containers/${c.data.id}/start`,
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /containers/:id/stop stops container", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    await app.inject({ method: "POST", url: `/containers/${c.data.id}/start` });
    const res = await app.inject({
      method: "POST",
      url: `/containers/${c.data.id}/stop`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("exited");
    expect(res.json().data.exitCode).toBe(0);
  });

  it("POST /containers/:id/stop container not found returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/containers/nope/stop",
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /containers/:id/stop not running returns 409", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    const res = await app.inject({
      method: "POST",
      url: `/containers/${c.data.id}/stop`,
    });
    expect(res.statusCode).toBe(409);
  });

  it("GET /containers/:id/logs returns logs", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    await app.inject({ method: "POST", url: `/containers/${c.data.id}/start` });
    const res = await app.inject({
      method: "GET",
      url: `/containers/${c.data.id}/logs`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.logs).toHaveLength(3);
  });

  it("GET /containers/:id/logs container not found returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/containers/nope/logs",
    });
    expect(res.statusCode).toBe(404);
  });

  it("container starts with null startedAt and exitCode", async () => {
    const img = (await pullImage(app)).json();
    const c = (await createContainer(app, img.data.id)).json();
    expect(c.data.startedAt).toBeNull();
    expect(c.data.exitCode).toBeNull();
  });

  it("image has size and layers", async () => {
    const img = (await pullImage(app)).json();
    expect(typeof img.data.size).toBe("number");
    expect(img.data.size).toBeGreaterThan(0);
    expect(typeof img.data.layers).toBe("number");
  });
});
