import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from './db.js'

// --------------------------------------------------
// 1. Initialize MCP server
// --------------------------------------------------

const server = new McpServer({
  name: 'taskpilot-mcp',
  version: '1.0.0'
})

// --------------------------------------------------
// 2. Database helper
// --------------------------------------------------

async function getTasksCollection () {
  const database = await connectToDatabase()
  return database.collection('tasks')
}

// --------------------------------------------------
// 3. Format MongoDB documents for responses
// --------------------------------------------------

function formatTask (task) {
  const { _id, ...data } = task

  return {
    id: _id.toString(),
    ...data
  }
}

// --------------------------------------------------
// 4. Validate MongoDB task IDs
// --------------------------------------------------

function isValidTaskId (taskId) {
  return (
    typeof taskId === 'string' &&
    ObjectId.isValid(taskId) &&
    new ObjectId(taskId).toString() === taskId
  )
}

// --------------------------------------------------
// 5. Standard response helpers
// --------------------------------------------------

function textResponse (data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  }
}

function errorResponse (message) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message
      }
    ]
  }
}

// --------------------------------------------------
// 6. Safely execute tool operations
// --------------------------------------------------

async function safelyRunTool (operation) {
  try {
    return await operation()
  } catch (error) {
    // Detailed errors stay in server logs.
    console.error('MCP tool operation failed:', error)

    // Do not expose database details or secrets to the caller.
    return errorResponse(
      'The operation failed. Check the MCP server logs and database connection, then try again.'
    )
  }
}

// --------------------------------------------------
// TOOL 1: Get all tasks
// --------------------------------------------------

server.registerTool(
  'get_all_tasks',
  {
    title: 'Get All Tasks',
    description: 'Retrieve all tasks from the database.',
    inputSchema: {}
  },
  async () =>
    safelyRunTool(async () => {
      const collection = await getTasksCollection()
      const tasks = await collection.find({}).toArray()

      return textResponse(tasks.map(formatTask))
    })
)

// --------------------------------------------------
// TOOL 2: Get pending tasks
// --------------------------------------------------

server.registerTool(
  'get_pending_tasks',
  {
    title: 'Get Pending Tasks',
    description: 'Retrieve all tasks that have pending status.',
    inputSchema: {}
  },
  async () =>
    safelyRunTool(async () => {
      const collection = await getTasksCollection()

      const tasks = await collection.find({ status: 'pending' }).toArray()

      return textResponse(tasks.map(formatTask))
    })
)

// --------------------------------------------------
// TOOL 3: Get tasks by assignee
// --------------------------------------------------

server.registerTool(
  'get_tasks_by_assignee',
  {
    title: 'Get Tasks By Assignee',
    description: 'Retrieve tasks assigned to a specific person.',
    inputSchema: {
      assignee: z
        .string()
        .trim()
        .min(1, 'Assignee cannot be empty.')
        .max(80, 'Assignee cannot exceed 80 characters.')
    }
  },
  async ({ assignee }) =>
    safelyRunTool(async () => {
      const collection = await getTasksCollection()

      const tasks = await collection.find({ assignee }).toArray()

      return textResponse(tasks.map(formatTask))
    })
)

// --------------------------------------------------
// TOOL 4: Create a task
// --------------------------------------------------

server.registerTool(
  'create_task',
  {
    title: 'Create Task',
    description: 'Create a new task with a title and assignee.',
    inputSchema: {
      title: z
        .string()
        .trim()
        .min(1, 'Task title cannot be empty.')
        .max(150, 'Task title cannot exceed 150 characters.'),

      assignee: z
        .string()
        .trim()
        .min(1, 'Assignee cannot be empty.')
        .max(80, 'Assignee cannot exceed 80 characters.')
    }
  },
  async ({ title, assignee }) =>
    safelyRunTool(async () => {
      const collection = await getTasksCollection()

      const newTask = {
        title,
        assignee,
        status: 'pending',
        createdAt: new Date()
      }

      const result = await collection.insertOne(newTask)

      return textResponse({
        message: 'Task created successfully.',
        task: {
          id: result.insertedId.toString(),
          ...newTask
        }
      })
    })
)

// --------------------------------------------------
// TOOL 5: Update a task
// --------------------------------------------------

server.registerTool(
  'update_task',
  {
    title: 'Update Task',
    description:
      "Update a task's title, assignee, or status using its MongoDB ID.",
    inputSchema: {
      taskId: z.string().min(1, 'Task ID is required.'),

      title: z
        .string()
        .trim()
        .min(1, 'Task title cannot be empty.')
        .max(150, 'Task title cannot exceed 150 characters.')
        .optional(),

      assignee: z
        .string()
        .trim()
        .min(1, 'Assignee cannot be empty.')
        .max(80, 'Assignee cannot exceed 80 characters.')
        .optional(),

      status: z.enum(['pending', 'completed']).optional()
    }
  },
  async ({ taskId, title, assignee, status }) =>
    safelyRunTool(async () => {
      if (!isValidTaskId(taskId)) {
        return errorResponse('Invalid task ID format.')
      }

      const updates = {}

      if (title !== undefined) {
        updates.title = title
      }

      if (assignee !== undefined) {
        updates.assignee = assignee
      }

      if (status !== undefined) {
        updates.status = status
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse(
          'Provide at least one field to update: title, assignee, or status.'
        )
      }

      const collection = await getTasksCollection()

      const result = await collection.updateOne(
        { _id: new ObjectId(taskId) },
        { $set: updates }
      )

      if (result.matchedCount === 0) {
        return errorResponse('Task not found.')
      }

      const updatedTask = await collection.findOne({
        _id: new ObjectId(taskId)
      })

      return textResponse({
        message: 'Task updated successfully.',
        task: formatTask(updatedTask)
      })
    })
)

// --------------------------------------------------
// TOOL 6: Delete a task
// --------------------------------------------------

server.registerTool(
  'delete_task',
  {
    title: 'Delete Task',
    description: 'Permanently delete a task using its MongoDB ID.',
    inputSchema: {
      taskId: z.string().min(1, 'Task ID is required.')
    }
  },
  async ({ taskId }) =>
    safelyRunTool(async () => {
      if (!isValidTaskId(taskId)) {
        return errorResponse('Invalid task ID format.')
      }

      const collection = await getTasksCollection()

      const result = await collection.deleteOne({
        _id: new ObjectId(taskId)
      })

      if (result.deletedCount === 0) {
        return errorResponse('Task not found.')
      }

      return textResponse({
        message: 'Task deleted successfully.',
        taskId
      })
    })
)

// --------------------------------------------------
// 7. Start MCP server over standard input/output
// --------------------------------------------------

await serveStdio(server)
