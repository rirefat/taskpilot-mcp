
import "dotenv/config";
import { MongoClient } from "mongodb";

// --------------------------------------------------
// 1. Load MongoDB connection URI
// --------------------------------------------------

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "MONGODB_URI is missing. Please configure it in your .env file."
  );
}

// --------------------------------------------------
// 2. Configure MongoDB client
// --------------------------------------------------

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
});

// --------------------------------------------------
// 3. Database configuration
// --------------------------------------------------

const DATABASE_NAME = "MCP-Learning-DB";

let database;
let connectionPromise;

// --------------------------------------------------
// 4. Connect to MongoDB Atlas
// --------------------------------------------------

export async function connectToDatabase() {
  if (database) {
    return database;
  }

  // Reuse an in-progress connection to prevent duplicate connects.
  if (!connectionPromise) {
    connectionPromise = client
      .connect()
      .then(() => {
        database = client.db(DATABASE_NAME);

        console.error(
          `Connected to MongoDB database: ${DATABASE_NAME}`
        );

        return database;
      })
      .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        throw error;
      })
      .finally(() => {
        connectionPromise = undefined;
      });
  }

  return connectionPromise;
}

// --------------------------------------------------
// 5. Close MongoDB connection
// --------------------------------------------------

export async function closeDatabaseConnection() {
  if (connectionPromise) {
    await connectionPromise.catch(() => {});
  }

  if (!database) {
    return;
  }

  await client.close();

  database = undefined;

  console.error("MongoDB connection closed.");
}
