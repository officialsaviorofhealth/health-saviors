import type { Hono } from "hono";

export type Env = {
  Variables: {
    userId: string;
    wallet?: string;
    email?: string;
  };
};

export type AppContext = Parameters<Parameters<InstanceType<typeof Hono<Env>>["get"]>[1]>[0];
