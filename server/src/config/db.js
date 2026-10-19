import mongoose from 'mongoose';
import config from './env.js';
import logger from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    autoIndex: !config.isProduction,
  });
  logger.info(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function dropDatabase() {
  if (mongoose.connection.readyState === 1 && !config.isProduction) {
    await mongoose.connection.dropDatabase();
  }
}

export default connectDatabase;
