import { createServer } from "node:http";

export async function fakeServer(statuses: (number | "drop")[]): Promise<{
  url: string;
  bodies: string[];
  close: () => Promise<void>;
}> {
  const bodies: string[] = [];
  const server = createServer((request, response) => {
    request.setEncoding("utf8");
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      bodies.push(body);
      const status = statuses[bodies.length - 1] ?? 201;
      if (status === "drop") {
        request.socket.destroy();
        return;
      }
      response.statusCode = status;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ code: "fake", message: "test response" }));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: "http://127.0.0.1:" + server.address()!.port + "/api",
    bodies,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
