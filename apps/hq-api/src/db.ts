import mongoose from 'mongoose';
import { env } from './config.js';

let lastDatabaseError = '';

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return true;

  if (!env.mongoUri) {
    lastDatabaseError = 'No MongoDB connection string is visible to the runtime.';
    throw new Error(lastDatabaseError);
  }

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    lastDatabaseError = '';
    return true;
  } catch (error) {
    lastDatabaseError = error instanceof Error ? error.message : String(error);
    throw error;
  }
};

export const tryConnectDatabase = async () => {
  try {
    await connectDatabase();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ReemTeamHQ database connection failed: ${message}`);
    return false;
  }
};

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;

export const getDatabaseStatus = () => ({
  connected: isDatabaseConnected(),
  readyState: mongoose.connection.readyState,
  configuredKey: env.mongoUriSource,
  configured: Boolean(env.mongoUri),
  lastError: lastDatabaseError
});

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
