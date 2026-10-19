// src/lib/redis.ts — Redis connection for BullMQ
import { Redis } from "ioredis";

const getRedisConfig = () => ({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
});

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(getRedisConfig());
    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
    redisInstance.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }
  return redisInstance;
}

export { getRedisConfig };
