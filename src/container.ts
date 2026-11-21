export interface Image {
  id: string;
  name: string;
  tag: string;
  size: number;
  layers: number;
  createdAt: number;
}

export type ContainerStatus = "created" | "running" | "stopped" | "exited";

export interface PortMapping {
  host: number;
  container: number;
}

export interface Container {
  id: string;
  imageId: string;
  name: string;
  status: ContainerStatus;
  command: string[];
  env: Record<string, string>;
  ports: PortMapping[];
  createdAt: number;
  startedAt: number | null;
  exitCode: number | null;
}

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `${Date.now().toString(16)}${idCounter.toString(16)}`;
}

export class ContainerStore {
  private images: Map<string, Image> = new Map();
  private containers: Map<string, Container> = new Map();
  private containerNames: Map<string, string> = new Map();
  private logs: Map<string, string[]> = new Map();

  pullImage(name: string, tag: string = "latest"): Image {
    const image: Image = {
      id: generateId(),
      name,
      tag,
      size: 1024 * 1024 * (50 + ((idCounter * 7) % 200)),
      layers: 3 + (idCounter % 5),
      createdAt: Date.now(),
    };

    this.images = new Map(this.images);
    this.images.set(image.id, image);

    return image;
  }

  listImages(): Image[] {
    return [...this.images.values()];
  }

  getImage(id: string): Image | undefined {
    return this.images.get(id);
  }

  removeImage(id: string): boolean {
    if (!this.images.has(id)) return false;

    const updatedImages = new Map(this.images);
    updatedImages.delete(id);
    this.images = updatedImages;

    return true;
  }

  createContainer(
    imageId: string,
    name: string,
    command: string[],
    env: Record<string, string>,
    ports: PortMapping[],
  ): { container?: Container; imageFound: boolean; nameConflict: boolean } {
    if (!this.images.has(imageId)) {
      return { imageFound: false, nameConflict: false };
    }

    if (this.containerNames.has(name)) {
      return { imageFound: true, nameConflict: true };
    }

    const container: Container = {
      id: generateId(),
      imageId,
      name,
      status: "created",
      command,
      env,
      ports,
      createdAt: Date.now(),
      startedAt: null,
      exitCode: null,
    };

    this.containers = new Map(this.containers).set(container.id, container);
    this.containerNames = new Map(this.containerNames).set(name, container.id);
    this.logs = new Map(this.logs).set(container.id, []);

    return { container, imageFound: true, nameConflict: false };
  }

  listContainers(): Container[] {
    return [...this.containers.values()];
  }

  getContainer(id: string): Container | undefined {
    return this.containers.get(id);
  }

  removeContainer(id: string): boolean {
    const container = this.containers.get(id);
    if (!container) return false;

    const updatedContainers = new Map(this.containers);
    updatedContainers.delete(id);
    this.containers = updatedContainers;

    const updatedNames = new Map(this.containerNames);
    updatedNames.delete(container.name);
    this.containerNames = updatedNames;

    const updatedLogs = new Map(this.logs);
    updatedLogs.delete(id);
    this.logs = updatedLogs;

    return true;
  }

  startContainer(id: string): {
    container?: Container;
    found: boolean;
    alreadyRunning: boolean;
  } {
    const container = this.containers.get(id);

    if (!container) {
      return { found: false, alreadyRunning: false };
    }

    if (container.status === "running") {
      return { found: true, alreadyRunning: true };
    }

    const updatedContainer: Container = {
      ...container,
      status: "running",
      startedAt: Date.now(),
      exitCode: null,
    };

    this.containers = new Map(this.containers).set(id, updatedContainer);

    const commandText = container.command.join(" ") || "/bin/sh";

    this.logs = new Map(this.logs).set(id, [
      `[INFO] Container ${container.name} started`,
      `[INFO] Running command: ${commandText}`,
      "[INFO] Ready",
    ]);

    return {
      container: updatedContainer,
      found: true,
      alreadyRunning: false,
    };
  }

  stopContainer(id: string): {
    container?: Container;
    found: boolean;
    notRunning: boolean;
  } {
    const container = this.containers.get(id);

    if (!container) {
      return { found: false, notRunning: false };
    }

    if (container.status !== "running") {
      return { found: true, notRunning: true };
    }

    const updatedContainer: Container = {
      ...container,
      status: "exited",
      exitCode: 0,
    };

    this.containers = new Map(this.containers).set(id, updatedContainer);

    const currentLogs = this.logs.get(id) ?? [];

    this.logs = new Map(this.logs).set(id, [
      ...currentLogs,
      `[INFO] Container ${container.name} stopped`,
    ]);

    return {
      container: updatedContainer,
      found: true,
      notRunning: false,
    };
  }

  getLogs(id: string): string[] | undefined {
    if (!this.containers.has(id)) return undefined;

    return this.logs.get(id) ?? [];
  }
}
