import redisClient from '../config/redis.js';

// Get cached data, or null if not found
export const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

// Set cache with expiry (in seconds)
export const setCache = async (key, value, ttlSeconds = 300) => {
  await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

// Delete a cache key (call this when data changes)
export const deleteCache = async (key) => {
  await redisClient.del(key);
};