# TaskPilot MCP

TaskPilot MCP is a small Model Context Protocol (MCP) server for managing tasks stored in MongoDB. It runs over standard input/output (stdio), so MCP-compatible clients can retrieve, create, update, and delete tasks without a separate HTTP server.

## Features

- List all tasks or only tasks with `pending` status.
- Find tasks by assignee.
- Create tasks, which start with `pending` status.
- Update a task's title, assignee, and/or status.
- Delete a task by its MongoDB ObjectId.
- Validate tool inputs and return readable operation errors.

## Requirements

- Node.js compatible with the installed dependencies.
- A MongoDB deployment and a connection URI with read/write access to the task collection.
- An MCP-compatible client, such as Visual Studio Code with GitHub Copilot.

## Setup

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root and set the MongoDB connection URI:

   ```dotenv
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
   ```

   Replace the placeholders with your MongoDB deployment's connection details. Keep `.env` private and do not commit credentials.

3. Start the server directly to make it available to an MCP client:

   ```sh
   node index.js
   ```

   The server communicates over stdio. When launched by an MCP client, the client starts the process and exchanges MCP messages through its standard input and output.

## MCP client configuration

The repository includes `.vscode/mcp.json` with a stdio server entry. Its current `args` value points to this project's `index.js` using a machine-specific absolute path. Update that value to the location of your project before using this configuration on another machine. For example:

```json
{
  "servers": {
    "my-first-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/my-first-mcp/index.js"]
    }
  }
}
```

The server identifies itself to MCP clients as `taskpilot-mcp` (version `1.0.0`); `my-first-mcp` is the name used for the server entry in the VS Code configuration.

## Available tools

Successful tool results are returned as formatted JSON text. Validation & operation failures are returned as explanatory text errors.

| Tool | Inputs | Behavior |
| --- | --- | --- |
| `get_all_tasks` | None | Returns every document in the `tasks` collection. |
| `get_pending_tasks` | None | Returns tasks whose status is exactly `pending`. |
| `get_tasks_by_assignee` | `assignee` (string, 1–80 characters) | Returns tasks whose assignee exactly matches the supplied name. |
| `create_task` | `title` (string, 1–150 characters), `assignee` (string, 1–80 characters) | Inserts a task with `pending` status and a creation timestamp. Returns its generated ID and task details. |
| `update_task` | `taskId` (MongoDB ObjectId string); optional `title`, `assignee`, and `status` | Updates one or more supplied fields. Status must be `pending` or `completed`. At least one update field is required. Returns the updated task. |
| `delete_task` | `taskId` (MongoDB ObjectId string) | Permanently deletes the matching task. |

Updates and deletions return an error if the ID is invalid or no matching task exists. Creating a task does not check for duplicates; task titles are not required to be unique.

## Data storage

The server connects to the MongoDB database **`MCP-Learning-DB`** and uses its **`tasks`** collection. Each newly created document has this shape:

```json
{
  "_id": "MongoDB-generated ObjectId",
  "title": "Example task",
  "assignee": "Rafiul",
  "status": "pending",
  "createdAt": "MongoDB date"
}
```

Responses expose MongoDB's `_id` as a string field named `id`. Existing documents are returned with their other stored fields preserved.

## Troubleshooting

- **`MONGODB_URI is missing`**: Add `MONGODB_URI` to the root `.env` file. Do not include the URI in client configuration or source control.
- **Connection timeout or authentication error**: Check the URI, database user permissions, network access rules, and whether the MongoDB deployment is reachable.
- **Generic tool operation failure**: Check the MCP server's stderr/logs for the detailed error. The caller receives a generic message so database details are not included in tool responses.
- **Client cannot start the server**: Confirm Node.js is installed, dependencies are present (`npm install`), and the configured `index.js` path is correct.

## Project files

- `index.js` registers the MCP tools, validates inputs, and starts the stdio server.
- `db.js` loads the environment, manages the MongoDB connection, and selects the database.
- `.vscode/mcp.json` configures the local VS Code MCP server entry.
- `package.json` lists runtime dependencies and package metadata.

There is currently no automated test suite configured in `package.json`.
