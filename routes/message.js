const express = require('express');
const messageService = require('../services/messageService');
const logger = require('../config/logger');
const { jwtTokenValidation } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /message/template:
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
 *         `POST /message/template`
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
 *       - in: query
 *         name: campaignName
 *         required: false
 *         schema:
 *           type: string
 *         description: Name of the campaign, used for identification and filtering.
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
 *                 _id:
 *                   type: string
 *                   description: Unique campaign identifier
 *                   example: '507f1f77bcf86cd799439011'
 *                 campaignName:
 *                   type: string
 *                   description: Name of the campaign
 *                   example: 'Campaign 2024-01-15 10:30:00'
 *                 templateName:
 *                   type: string
 *                   description: Name of the template used
 *                   example: 'welcome_template'
 *                 language:
 *                   type: string
 *                   description: Language code used for the template
 *                   example: 'pt_BR'
 *                 fromPhoneNumber:
 *                   type: string
 *                   description: Phone number that sent the messages
 *                   example: '5511999999999'
 *                 dateTime:
 *                   type: string
 *                   format: date-time
 *                   description: Campaign execution timestamp
 *                   example: '2024-01-15T10:30:00.000Z'
 *                 total:
 *                   type: integer
 *                   description: Total number of messages sent
 *                   example: 2
 *                 success:
 *                   type: integer
 *                   description: Number of successfully sent messages
 *                   example: 2
 *                 failed:
 *                   type: integer
 *                   description: Number of failed messages
 *                   example: 0
 *                 results:
 *                   type: array
 *                   description: Detailed results for each message
 *                   items:
 *                     type: object
 *                     properties:
 *                       phoneNumber:
 *                         type: string
 *                         description: Recipient phone number
 *                         example: '5511999999999'
 *                       messageId:
 *                         type: string
 *                         description: WhatsApp message ID
 *                         example: 'wamid.HBgMNTUxMTk5OTk5OTk5FQIAERgSODg3QzA4QzA4QzA4QzA4AA=='
 *                       status:
 *                         type: string
 *                         description: Message status
 *                         example: 'sent'
 *                       success:
 *                         type: boolean
 *                         description: Whether the message was sent successfully
 *                         example: true
 *                       error:
 *                         type: string
 *                         nullable: true
 *                         description: Error message if the message failed
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
router.post('/template', jwtTokenValidation('editor'), async (req, res) => {
    try {
        const { template_name, phone_messages, wabaId, apiToken, phoneId, language, fromPhoneNumber, projectId } = req.body;
        let { campaignName } = req.query;

        campaignName = campaignName || `Campaign ${new Date().toISOString().replace('T', ' ').replace('Z', '')}`;

        if (!template_name || !phone_messages || !Array.isArray(phone_messages) || !language) {
            return res.status(400).json({ error: 'Invalid input: template_name, phone_messages array, and language are required' });
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
            languageCode: language,
            fromPhoneNumber,
            projectId,
            campaignName
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error('MessageRoute: Error in POST /message-template', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});

/**
 * @swagger
 * /message/campaign:
 *   get:
 *     summary: Get WhatsApp campaign data
 *     description: |
 *       Retrieve campaign data for a project. You can filter by campaign id and/or name.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is optional.
 *       - The **`campaignId`** and **`campaignName`** parameters are optional and can be used to filter the results.
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. (optional)
 *       - `campaignId`: Unique identifier of the campaign. (optional)
 *       - `campaignName`: Name of the campaign. (optional)
 *
 *       **Examples:**
 *       - Get all campaigns for a project:
 *         `GET /message/campaign?projectId=123`
 *       - Get a campaign by id:
 *         `GET /message/campaign?projectId=123&campaignId=687956f1cce5e63266136961`
 *       - Get a campaign by name:
 *         `GET /message/campaign?projectId=123&campaignName=Campaign%202025-07-17%2020:02:57.712`
 *
 *     tags:
 *       - Message
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project.
 *       - in: query
 *         name: campaignId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the campaign.
 *       - in: query
 *         name: campaignName
 *         required: false
 *         schema:
 *           type: string
 *         description: Name of the campaign.
 *     responses:
 *       200:
 *         description: Campaign(s) found.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Unique campaign identifier
 *                     example: '687956f1cce5e63266136961'
 *                   campaignName:
 *                     type: string
 *                     description: Name of the campaign
 *                     example: 'Campaign 2025-07-17 20:02:57.712'
 *                   templateName:
 *                     type: string
 *                     description: Name of the template used
 *                     example: 'hello_world'
 *                   language:
 *                     type: string
 *                     description: Language code used for the template
 *                     example: 'en_US'
 *                   fromPhoneNumber:
 *                     type: string
 *                     description: Phone number that sent the messages
 *                     example: '+15556287518'
 *                   dateTime:
 *                     type: string
 *                     format: date-time
 *                     description: Campaign execution timestamp
 *                     example: '2025-07-17T20:02:57.712Z'
 *                   total:
 *                     type: integer
 *                     description: Total number of messages sent
 *                     example: 1
 *                   success:
 *                     type: integer
 *                     description: Number of successfully sent messages
 *                     example: 1
 *                   failed:
 *                     type: integer
 *                     description: Number of failed messages
 *                     example: 0
 *                   results:
 *                     type: array
 *                     description: Detailed results for each message
 *                     items:
 *                       type: object
 *                       properties:
 *                         phoneNumber:
 *                           type: string
 *                           description: Recipient phone number
 *                           example: '553196371744'
 *                         messageId:
 *                           type: string
 *                           description: WhatsApp message ID
 *                           example: 'wamid.HBgMNTUzMTk2MzcxNzQ0FQIAERgSRjVDQUEzMUJDNERFRTlCQkU3AA=='
 *                         status:
 *                           type: string
 *                           description: Message status
 *                           example: 'answered'
 *                         success:
 *                           type: boolean
 *                           description: Whether the message was sent successfully
 *                           example: true
 *                         sentDateTime:
 *                           type: string
 *                           format: date-time
 *                           description: Date/time when the message was sent
 *                           example: '2025-07-17T20:02:58.000Z'
 *                         deliveredDateTime:
 *                           type: string
 *                           format: date-time
 *                           description: Date/time when the message was delivered
 *                           example: '2025-07-17T20:02:58.000Z'
 *                         readDateTime:
 *                           type: string
 *                           format: date-time
 *                           description: Date/time when the message was read
 *                           example: '2025-07-17T20:05:12.000Z'
 *                         answers:
 *                           type: array
 *                           description: List of answers received for this message
 *                           items:
 *                             type: object
 *                             properties:
 *                               messageId:
 *                                 type: string
 *                                 description: WhatsApp message ID of the answer
 *                                 example: 'wamid.HBgMNTUzMTk2MzcxNzQ0FQIAEhgUM0EwOTNCNTgwODVEQzM0NUVDMTMA'
 *                               messageText:
 *                                 type: string
 *                                 description: Text of the answer
 *                                 example: 'Ok!'
 *                               messageType:
 *                                 type: string
 *                                 description: Type of the answer message
 *                                 example: 'text'
 *                               messageDateTime:
 *                                 type: string
 *                                 format: date-time
 *                                 description: Date/time when the answer was sent
 *                                 example: '2025-07-17T20:07:33.000Z'
 *       404:
 *         description: No campaigns found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'No campaigns found'
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
router.get('/campaign', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { campaignId, campaignName } = req.query;
        const { projectId } = req.body;
        const campaigns = await messageService.getCampaigns({ projectId, campaignId, campaignName });
        if (!campaigns || campaigns.length === 0) {
            return res.status(404).json({ error: 'No campaigns found' });
        }
        res.status(200).json(campaigns);
    } catch (error) {
        logger.error('MessageRoute: Error in GET /message/campaign', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});
module.exports = router; 