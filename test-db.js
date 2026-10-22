import { connectToDatabase, closeDatabaseConnection } from './db.js'

try {
  const database = await connectToDatabase()

  // A lightweight database command to verify connectivity
  await database.command({ ping: 1 })

  console.log('Success! Connected to MongoDB Atlas.')
  console.log('Database:', database.databaseName)
} catch (error) {
  console.error('MongoDB connection failed:', error.message)
  process.exitCode = 1
} finally {
  await closeDatabaseConnection().catch(() => {})
}
