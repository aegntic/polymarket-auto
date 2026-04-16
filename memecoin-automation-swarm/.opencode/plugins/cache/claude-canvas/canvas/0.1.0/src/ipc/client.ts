// IPC Client - Canvas side
// Connects to the controller's Unix domain socket

import type { ControllerMessage, CanvasMessage } from "./types";
import type { Socket } from "bun";

export interface IPCClientOptions {
  socketPath: string;
  onMessage: (msg: ControllerMessage) => void;
  onDisconnect: () => void;
  onError?: (error: Error) => void;
}

export interface IPCClient {
  send: (msg: CanvasMessage) => void;
  close: () => void;
  isConnected: () => boolean;
}

export async function connectToController(
  options: IPCClientOptions
): Promise<IPCClient> {
  const { socketPath, onMessage, onDisconnect, onError } = options;

  let connected = false;
  let buffer = "";

  const socket = await Bun.connect({
    unix: socketPath,
    socket: {
      open(socket) {
        connected = true;
      },

      data(socket, data) {
        // Accumulate data and parse complete JSON messages
        buffer += data.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as ControllerMessage;
              onMessage(msg);
            } catch (e) {
              onError?.(new Error(`Failed to parse message: ${line}`));
            }
          }
        }
      },

      close() {
        connected = false;
        onDisconnect();
      },

      error(socket, error) {
        onError?.(error);
      },
    },
  });

  connected = true;

  return {
    send(msg: CanvasMessage) {
      if (connected) {
        socket.write(JSON.stringify(msg) + "\n");
      }
    },

    close() {
      socket.end();
      connected = false;
    },

    isConnected() {
      return connected;
    },
  };
}

// Attempt to connect with retries
export async function connectWithRetry(
  options: IPCClientOptions,
  maxRetries = 10,
  retryDelayMs = 100
): Promise<IPCClient> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connectToController(options);
    } catch (e) {
      lastError = e as Error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError || new Error("Failed to connect to controller");
}
