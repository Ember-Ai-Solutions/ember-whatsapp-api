const express = require('express');
const messageService = require('../services/messageService');
const logger = require('../config/logger');
const { jwtTokenValidation } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send WhatsApp template messages
 *     description: |
 *       Send a WhatsApp template message to one or more phone numbers using a pre-approved template.
 *
 *       - Requires JWT authentication with at least 'editor' role for the project.
 *       - The **`projectId`** parameter is required only for user JWTs (not for service JWTs).
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. **Required if using a user JWT. Not required for service JWT.**
 *       - `template_name`: Name of the WhatsApp template to send (must be pre-approved). (required)
 *       - `language`: Language code for the template (e.g., en_US, pt_BR). (required)
 *       - `phone_messages`: List of phone numbers and variables for each message. (required)
 *         - `phone_number`: Recipient phone number in international format. (required)
 *         - `variables`: Key-value pairs for template variables (optional).
 *
 *       **Examples:**
 *       - Send a template message to multiple recipients:
 *         `POST /message`
 *         Body:
 *         {
 *           "template_name": "order_confirmation",
 *           "language": "pt_BR",
 *           "phone_messages": [
 *             { "phone_number": "5511999999999", "variables": { "1": "John" } },
 *             { "phone_number": "5511888888888", "variables": { "1": "Maria" } }
 *           ]
 *         }
 *
 *     tags:
 *       - Message
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
 *               - template_name
 *               - language
 *               - phone_messages
 *             properties:
 *               template_name:
 *                 type: string
 *                 description: Name of the WhatsApp template to send (must be pre-approved in Meta).
 *                 example: welcome_template
 *               language:
 *                 type: string
 *                 description: Language code for the template (e.g., en_US, pt_BR).
 *                 example: pt_BR
 *               phone_messages:
 *                 type: array
 *                 description: List of phone numbers and variables for each message.
 *                 items:
 *                   type: object
 *                   properties:
 *                     phone_number:
 *                       type: string
 *                       description: Recipient phone number in international format.
 *                       example: '5511999999999'
 *                     variables:
 *                       type: object
 *                       description: Key-value pairs for template variables (optional).
 *                       example: { "1": "John", "2": "123456" }
 *     responses:
 *       200:
 *         description: Messages sent successfully.
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
 *                   example: "Template messages sent. Success: 2, Failed: 0"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       phone_number:
 *                         type: string
 *                         example: '5511999999999'
 *                       message_id:
 *                         type: string
 *                         example: 'wamid.HBgMNTUxMTk5OTk5OTk5FQIAERgSODg3QzA4QzA4QzA4QzA4AA=='
 *                       status:
 *                         type: string
 *                         example: sent
 *                       success:
 *                         type: boolean
 *                         example: true
 *                       error:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid input: template_name and phone_messages array are required"
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
        const { template_name, phone_messages, wabaId, apiToken, phoneId, language } = req.body;

        if (!template_name || !phone_messages || !Array.isArray(phone_messages)) {
            return res.status(400).json({ error: 'Invalid input: template_name and phone_messages array are required' });
        }

        const phone_numbers = phone_messages.map(msg => msg.phone_number);
        const variablesList = phone_messages.map(msg => msg.variables || {});

        const result = await messageService.sendTemplateMessages({
            wabaId,
            apiToken,
            template_name,
            phone_numbers,
            variablesList,
            phoneId,
            language
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error('MessageRoute: Error in POST /message', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});
module.exports = router; 