const express = require('express');
const templateService = require('../services/templateService');
const logger = require('../config/logger');
const { jwtTokenValidation } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /template:
 *   post:
 *     summary: Create a new WhatsApp template
 *     description: |
 *       Create a new WhatsApp template for the project.
 *
 *       - Requires JWT authentication with at least 'editor' role for the project.
 *       - The **`projectId`** parameter is required only for user JWTs (not for service JWTs).
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. **Required if using a user JWT. Not required for service JWT.**
 *       - `name`: Name of the template to create. (required)
 *       - `category`: Category of the template (e.g., TRANSACTIONAL, MARKETING). (required)
 *       - `language`: Language code for the template (e.g., en_US, pt_BR). (required)
 *       - `components`: Components of the template (body, header, footer, buttons, etc). (required)
 *       - `parameter_format`: Format for template parameters (optional).
 *
 *       **Examples:**
 *       - Create a template:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "order_confirmation",
 *           "category": "TRANSACTIONAL",
 *           "language": "pt_BR",
 *           "components": [ ... ],
 *           "parameter_format": "numbered"
 *         }
 *
 *     tags:
 *       - Template
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project. Required if using a user JWT. Not required for service JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - language
 *               - components
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the template to create.
 *                 example: welcome_template
 *               category:
 *                 type: string
 *                 description: Category of the template (e.g., TRANSACTIONAL, MARKETING).
 *                 example: TRANSACTIONAL
 *               language:
 *                 type: string
 *                 description: Language code for the template (e.g., en_US, pt_BR).
 *                 example: pt_BR
 *               components:
 *                 type: array
 *                 description: Components of the template (body, header, footer, buttons, etc).
 *                 items:
 *                   type: object
 *               parameter_format:
 *                 type: string
 *                 description: Format for template parameters (optional).
 *                 example: numbered
 *     responses:
 *       201:
 *         description: Template created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 1234567890
 *                 name:
 *                   type: string
 *                   example: welcome_template
 *                 content:
 *                   type: string
 *                   example: Welcome, {{1}}!
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid input
 *       401:
 *         description: Unauthorized. JWT is missing, invalid, or does not have the required role.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 *                 details:
 *                   type: string
 *                   example: Error details or stack trace
 *     security:
 *       - bearerAuth: []
 */
router.post('/', jwtTokenValidation('editor'), async (req, res) => {
    try {
        const { wabaId, apiToken } = req.body;
        const { name, category, language, components, parameter_format } = req.body;
        if (!name || !category || !language || !components) {
            return res.status(400).json({ error: 'Invalid input' });
        }
        const result = await templateService.createTemplate({ wabaId, apiToken, name, category, language, components, parameter_format });
        res.status(201).json(result);
    } catch (error) {
        logger.error('TemplateRoute: Error in POST /template', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});

/**
 * @swagger
 * /template:
 *   get:
 *     summary: List WhatsApp templates
 *     description: |
 *       Retrieve WhatsApp templates for the project.
 *
 *       - You can filter by name, language, status, category, content, and more using query parameters.
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required only for user JWTs (not for service JWTs).
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. **Required if using a user JWT. Not required for service JWT.**
 *       - `name`: Filter by template name (optional).
 *       - `language`: Filter by template language (optional).
 *       - `status`: Filter by template status (optional).
 *       - `category`: Filter by template category (optional).
 *       - `content`: Filter by template content (optional).
 *       - `fields`: Comma-separated list of fields to return (optional).
 *       - `limit`: Limit number of results (optional).
 *       - `name_or_content`: Filter by template name or content (optional).
 *       - `quality_score`: Filter by template quality score (optional).
 *
 *       **Examples:**
 *       - List all templates:
 *         `GET /template`
 *       - List templates by name:
 *         `GET /template?name=order_confirmation`
 *       - List templates by name and language:
 *         `GET /template?name=order_confirmation&language=pt_BR`
 *
 *     tags:
 *       - Template
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project. Required if using a user JWT. Not required for service JWT.
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to return.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by template status.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by template category.
 *       - in: query
 *         name: content
 *         schema:
 *           type: string
 *         description: Filter by template content.
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by template language.
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by template name.
 *       - in: query
 *         name: name_or_content
 *         schema:
 *           type: string
 *         description: Filter by template name or content.
 *       - in: query
 *         name: quality_score
 *         schema:
 *           type: string
 *         description: Filter by template quality score.
 *     responses:
 *       200:
 *         description: List of templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: 1234567890
 *                   name:
 *                     type: string
 *                     example: welcome_template
 *                   content:
 *                     type: string
 *                     example: Welcome, {{1}}!
 *       401:
 *         description: Unauthorized. JWT is missing, invalid, or does not have the required role.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 *                 details:
 *                   type: string
 *                   example: Error details or stack trace
 *     security:
 *       - bearerAuth: []
 */
router.get('/', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { fields, limit, status, category, content, language, name, name_or_content, quality_score } = req.query;
        const { wabaId, apiToken } = req.body;
        const result = await templateService.listTemplates({ wabaId, apiToken, fields, limit, status, category, content, language, name, name_or_content, quality_score });
        res.status(200).json(result);
    } catch (error) {
        logger.error('TemplateRoute: Error in GET /template', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});

/**
 * @swagger
 * /template:
 *   delete:
 *     summary: Delete WhatsApp template(s) by name or by ID and name
 *     description: |
 *       Delete WhatsApp template(s) for the project.
 *
 *       - If you provide only the `name` parameter, **all templates with that name** (in all languages) will be deleted.
 *       - If you provide both `templateId` and `name`, **only the template with that specific ID and name** will be deleted.
 *       - Requires JWT authentication with at least 'editor' role for the project.
 *       - The **`projectId`** parameter is required only for user JWTs (not for service JWTs).
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. **Required if using a user JWT. Not required for service JWT.**
 *       - `name`: Name of the template to delete. If only this parameter is provided, all templates with this name (in all languages) will be deleted.
 *       - `templateId`: Unique identifier of the template. If provided together with 'name', only the template with this ID and name will be deleted.
 *
 *       **Examples:**
 *       - Delete by name (all languages):
 *         `DELETE /template?name=order_confirmation`
 *       - Delete by ID and name:
 *         `DELETE /template?name=order_confirmation&templateId=1407680676729941`
 *
 *     tags:
 *       - Template
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project. Required if using a user JWT. Not required for service JWT.
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the template to delete. If only this parameter is provided, all templates with this name (in all languages) will be deleted.
 *       - in: query
 *         name: templateId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the template. If provided together with 'name', only the template with this ID and name will be deleted.
 *     responses:
 *       200:
 *         description: Template(s) deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Template(s) deleted successfully
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Template name is required"
 *       401:
 *         description: Unauthorized. JWT is missing, invalid, or does not have the required role.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Template not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Template not found
 *       500:
 *         description: Internal server error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 *                 details:
 *                   type: string
 *                   example: Error details or stack trace
 *     security:
 *       - bearerAuth: []
 */
router.delete('/', jwtTokenValidation('editor'), async (req, res) => {
    try {
        const { name, templateId } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'Template name is required' });
        }
        const { wabaId, apiToken } = req.body;
        let result;
        if (templateId) {
            result = await templateService.deleteTemplateByIdAndName({ wabaId, apiToken, templateId, name });
        } else {
            result = await templateService.deleteTemplateByName({ wabaId, apiToken, name });
        }
        res.status(200).json(result);
    } catch (error) {
        logger.error('TemplateRoute: Error in DELETE /template', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});

module.exports = router; 