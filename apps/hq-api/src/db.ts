import mongoose from 'mongoose';
import { env } from './config.js';

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.mongoUri);
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
