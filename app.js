require('dotenv').config();
const express = require('express');
const logger = require('./config/logger');
const messageRoutes = require('./routes/message');
const templateRoutes = require('./routes/template');
const bodyParser = require('body-parser');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();

app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(bodyParser.urlencoded({ extended: true }));

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Ember WhatsApp API',
        version: '1.0.0',
        description: 'A robust and well-documented RESTful API for sending WhatsApp template messages and managing Meta templates.\n\nFeatures:\n- Send WhatsApp template messages to multiple recipients.\n- Manage (create, list, delete) Meta templates.\n- JWT-based authentication and project-level authorization.\n- MongoDB integration for project and client management.\n- Fully documented with Swagger (OpenAPI 3.0).',
        contact: {
            name: 'Ember API Support',
            url: 'https://github.com/Ember-Ai-Solutions/ember-whatsapp-api',
            email: 'emberaitecnologia@gmail.com'
        }
    },
    tags: [
        {
            name: 'Message',
            description: 'Endpoints for sending WhatsApp template messages.'
        },
        {
            name: 'Template',
            description: 'Endpoints for managing Meta WhatsApp templates.'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token in the format: Bearer <token>'
            }
        }
    },
    security: [{ bearerAuth: [] }]
};

const options = {
    swaggerDefinition,
    apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/message', messageRoutes);
app.use('/template', templateRoutes);

app.use((err, req, res, next) => {
    logger.error('App: Unhandled error', { error: err.message });
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`App: Server running on port ${PORT}`);
    logger.info(`App: Swagger docs available at /docs`);
}); 