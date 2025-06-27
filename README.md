# Ember WhatsApp API

A robust RESTful API for sending WhatsApp template messages and managing Meta templates, with JWT authentication and MongoDB integration.

## Overview

This API allows you to:
- Send WhatsApp template messages to one or multiple recipients using pre-approved templates.
- Create, list, and delete WhatsApp templates (Meta templates) for your business account.
- Secure endpoints with JWT authentication and project-level authorization.
- Integrate with MongoDB for project and client management.
- Explore and test all endpoints via the built-in Swagger documentation.

## Authentication

All endpoints require JWT authentication. There are two types of JWTs:
- **User JWT**: Requires the `projectId` parameter in requests.
- **Service JWT**: Does not require the `projectId` parameter.

The required role for each endpoint is specified in the Swagger documentation (e.g., 'viewer', 'editor').

## Main Endpoints

### Send WhatsApp Template Message
- **POST /message**
- Send a template message to one or more phone numbers.
- Requires: `template_name`, `language`, `phone_messages` (array of phone numbers and variables).
- See Swagger for detailed request/response examples.

### Manage Templates
- **POST /template**: Create a new template.
- **GET /template**: List templates, with filters for name, language, status, etc.
- **DELETE /template**: Delete templates by name (all languages) or by name and templateId (specific template).

All template endpoints require at least 'editor' role (except GET, which requires 'viewer').

## Usage Examples

### Send a Template Message
```json
POST /message
{
  "template_name": "order_confirmation",
  "language": "pt_BR",
  "phone_messages": [
    { "phone_number": "5511999999999", "variables": { "1": "John" } },
    { "phone_number": "5511888888888", "variables": { "1": "Maria" } }
  ]
}
```

### Delete a Template by Name
```
DELETE /template?name=order_confirmation
```

### Delete a Template by Name and ID
```
DELETE /template?name=order_confirmation&templateId=1407680676729941
```

### List Templates by Name and Language
```
GET /template?name=order_confirmation&language=pt_BR
```

## Folder Structure

- `app.js` - Express server entry point
- `config/` - Logger and environment configuration
- `services/` - Integration services (MongoDB, templates, etc.)
- `middleware/` - Custom middlewares (authentication, etc.)
- `routes/` - API route definitions
- `logs/` - Application logs

## Environment Variables

- `EMBER_AUTH_URL` - Authentication service URL
- `META_API_VERSION` - Meta API version
- `MONGODB_URI` - MongoDB connection string
- `MONGO_CLIENTS_DB_NAME` - MongoDB clients database name
- `MONGO_PROJECTS_COLLECTION_NAME` - MongoDB projects collection name

## Best Practices
- All logs are in English and handled by Winston (console and file).
- Use JWTs with the correct role and project context for each request.
- Explore and test the API using the Swagger UI at `/api-docs` after starting the server.

---
For full API details, request/response schemas, and authentication requirements, see the Swagger documentation at `/api-docs`. 