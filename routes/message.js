const express = require('express');
const messageService = require('../services/messageService');
const logger = require('../config/logger');
const { jwtTokenValidation } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send WhatsApp messages
 *     description: |
 *       Send a WhatsApp message to a single recipient. Supports multiple message types including text, image, document, video, audio, location, contact, and interactive messages.
 *
 *       - Requires JWT authentication with at least 'editor' role for the project.
 *       - The **`projectId`** parameter is required only for user JWTs (not for service JWTs).
 *       - This endpoint sends individual messages without creating campaigns.
 *
 *       **Parameter details:**
 *       - `projectId`: Unique identifier of the project. **Required if using a user JWT. Not required for service JWT.**
 *       - `message_type`: Type of message to send (text, image, document, video, audio, location, contact, interactive). (required)
 *       - `phone_number`: Recipient phone number in international format. (required)
 *       - `content`: Message content or data based on message type. (required)
 *
 *       **Message Types and Content Examples:**
 *
 *       **Text Message:**
 *       ```json
 *       {
 *         "message_type": "text",
 *         "phone_number": "5511999999999",
 *         "content": "Hello! How are you today?"
 *       }
 *       ```
 *
 *       **Image Message:**
 *       ```json
 *       {
 *         "message_type": "image",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "link": "https://example.com/image.jpg",
 *           "caption": "Check out this amazing image!"
 *         }
 *       }
 *       ```
 *
 *       **Document Message:**
 *       ```json
 *       {
 *         "message_type": "document",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "link": "https://example.com/document.pdf",
 *           "caption": "Important document for you",
 *           "filename": "document.pdf"
 *         }
 *       }
 *       ```
 *
 *       **Video Message:**
 *       ```json
 *       {
 *         "message_type": "video",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "link": "https://example.com/video.mp4",
 *           "caption": "Watch this amazing video!"
 *         }
 *       }
 *       ```
 *
 *       **Audio Message:**
 *       ```json
 *       {
 *         "message_type": "audio",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "link": "https://example.com/audio.mp3"
 *         }
 *       }
 *       ```
 *
 *       **Location Message:**
 *       ```json
 *       {
 *         "message_type": "location",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "latitude": -23.5505,
 *           "longitude": -46.6333,
 *           "name": "São Paulo, Brazil",
 *           "address": "São Paulo, SP, Brazil"
 *         }
 *       }
 *       ```
 *
 *       **Contact Message:**
 *       ```json
 *       {
 *         "message_type": "contact",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "contacts": [
 *             {
 *               "name": {
 *                 "formatted_name": "John Doe",
 *                 "first_name": "John",
 *                 "last_name": "Doe"
 *               },
 *               "phones": [
 *                 {
 *                   "phone": "5511999999999",
 *                   "type": "CELL"
 *                 }
 *               ],
 *               "emails": [
 *                 {
 *                   "email": "john.doe@example.com",
 *                   "type": "WORK"
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *       }
 *       ```
 *
 *       **Interactive Message (List):**
 *       ```json
 *       {
 *         "message_type": "interactive",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "type": "list",
 *           "header": {
 *             "type": "text",
 *             "text": "Choose an option:"
 *           },
 *           "body": {
 *             "text": "Select one of the following options:"
 *           },
 *           "action": {
 *             "button": "Select",
 *             "sections": [
 *               {
 *                 "title": "Section 1",
 *                 "rows": [
 *                   {
 *                     "id": "1",
 *                     "title": "Option 1",
 *                     "description": "Description for option 1"
 *                   },
 *                   {
 *                     "id": "2",
 *                     "title": "Option 2",
 *                     "description": "Description for option 2"
 *                   }
 *                 ]
 *               }
 *             ]
 *           }
 *         }
 *       }
 *       ```
 *
 *       **Interactive Message (Button):**
 *       ```json
 *       {
 *         "message_type": "interactive",
 *         "phone_number": "5511999999999",
 *         "content": {
 *           "type": "button",
 *           "header": {
 *             "type": "text",
 *             "text": "Welcome!"
 *           },
 *           "body": {
 *             "text": "Please select an option:"
 *           },
 *           "action": {
 *             "buttons": [
 *               {
 *                 "type": "reply",
 *                 "reply": {
 *                   "id": "yes",
 *                   "title": "Yes"
 *                 }
 *               },
 *               {
 *                 "type": "reply",
 *                 "reply": {
 *                   "id": "no",
 *                   "title": "No"
 *                 }
 *               }
 *             ]
 *           }
 *         }
 *       }
 *       ```
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
 *               - message_type
 *               - phone_number
 *               - content
 *             properties:
 *               message_type:
 *                 type: string
 *                 enum: [text, image, document, video, audio, location, contact, interactive]
 *                 description: Type of message to send
 *                 example: text
 *               phone_number:
 *                 type: string
 *                 description: Recipient phone number in international format
 *                 example: '5511999999999'
 *               content:
 *                 oneOf:
 *                   - type: string
 *                     description: Text content for text messages
 *                     example: 'Hello! How are you today?'
 *                   - type: object
 *                     description: Content object for media and interactive messages
 *                     properties:
 *                       link:
 *                         type: string
 *                         description: URL for media files
 *                         example: 'https://example.com/image.jpg'
 *                       caption:
 *                         type: string
 *                         description: Caption for media files
 *                         example: 'Check out this amazing image!'
 *                       filename:
 *                         type: string
 *                         description: Filename for document messages
 *                         example: 'document.pdf'
 *                       latitude:
 *                         type: number
 *                         description: Latitude for location messages
 *                         example: -23.5505
 *                       longitude:
 *                         type: number
 *                         description: Longitude for location messages
 *                         example: -46.6333
 *                       name:
 *                         type: string
 *                         description: Location name
 *                         example: 'São Paulo, Brazil'
 *                       address:
 *                         type: string
 *                         description: Location address
 *                         example: 'São Paulo, SP, Brazil'
 *                       contacts:
 *                         type: array
 *                         description: Contact information for contact messages
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: object
 *                               properties:
 *                                 formatted_name:
 *                                   type: string
 *                                   example: 'John Doe'
 *                                 first_name:
 *                                   type: string
 *                                   example: 'John'
 *                                 last_name:
 *                                   type: string
 *                                   example: 'Doe'
 *                             phones:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   phone:
 *                                     type: string
 *                                     example: '5511999999999'
 *                                   type:
 *                                     type: string
 *                                     example: 'CELL'
 *                             emails:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   email:
 *                                     type: string
 *                                     example: 'john.doe@example.com'
 *                                   type:
 *                                     type: string
 *                                     example: 'WORK'
 *                       type:
 *                         type: string
 *                         enum: [list, button]
 *                         description: Interactive message type
 *                         example: list
 *                       header:
 *                         type: object
 *                         description: Header for interactive messages
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: text
 *                           text:
 *                             type: string
 *                             example: 'Choose an option:'
 *                       body:
 *                         type: object
 *                         description: Body for interactive messages
 *                         properties:
 *                           text:
 *                             type: string
 *                             example: 'Select one of the following options:'
 *                       action:
 *                         type: object
 *                         description: Action for interactive messages
 *                         properties:
 *                           button:
 *                             type: string
 *                             description: Button text for list messages
 *                             example: 'Select'
 *                           sections:
 *                             type: array
 *                             description: Sections for list messages
 *                             items:
 *                               type: object
 *                               properties:
 *                                 title:
 *                                   type: string
 *                                   example: 'Section 1'
 *                                 rows:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       id:
 *                                         type: string
 *                                         example: '1'
 *                                       title:
 *                                         type: string
 *                                         example: 'Option 1'
 *                                       description:
 *                                         type: string
 *                                         example: 'Description for option 1'
 *                           buttons:
 *                             type: array
 *                             description: Buttons for button messages
 *                             items:
 *                               type: object
 *                               properties:
 *                                 type:
 *                                   type: string
 *                                   example: reply
 *                                 reply:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                       example: 'yes'
 *                                     title:
 *                                       type: string
 *                                       example: 'Yes'
 *           example:
 *             message_type: "text"
 *             phone_number: "5511999999999"
 *             content: "Hello! How are you today?"
 *     responses:
 *       200:
 *         description: Message sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *                   description: WhatsApp message ID
 *                   example: 'wamid.HBgMNTUxMTk5OTk5OTk5FQIAERgSODg3QzA4QzA4QzA4QzA4AA=='
 *                 status:
 *                   type: string
 *                   description: Message status
 *                   example: 'sent'
 *                 success:
 *                   type: boolean
 *                   description: Whether the message was sent successfully
 *                   example: true
 *                 phoneNumber:
 *                   type: string
 *                   description: Recipient phone number
 *                   example: '5511999999999'
 *                 messageType:
 *                   type: string
 *                   description: Type of message sent
 *                   example: 'text'
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid input: message_type, phone_number, and content are required"
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
        const { message_type, phone_number, content } = req.body;
        const { wabaId, apiToken, phoneId, fromPhoneNumber, projectId } = req.body;

        if (!message_type || !phone_number || !content) {
            return res.status(400).json({ error: 'Invalid input: message_type, phone_number, and content are required' });
        }

        const result = await messageService.sendMessage({
            wabaId,
            apiToken,
            message_type,
            phone_number,
            content,
            phoneId,
            fromPhoneNumber,
            projectId
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error('MessageRoute: Error in POST /message', { error: error.message });
        res.status(500).json({ error: 'Internal server error', details: error.response?.data || error.message });
    }
});

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
 *         - `variables`: Array of variable components for template (header, body, button, etc.). (required)
 *           - `type`: Component type (header, body, button, footer)
 *           - `parameters`: Array of parameters for the component
 *             - `type`: Parameter type (text, image, document, video)
 *             - `text`: Text value for text parameters
 *             - `parameter_name`: Parameter name for named parameters (optional)
 *             - `image`: Image object for image parameters (optional)
 *             - `index`: Button index for button parameters (optional)
 *             - `sub_type`: Button sub-type for button parameters (optional)
 *
 *       **Examples:**
 *       - Send a template message with positional parameters:
 *         `POST /message/template`
 *         Body:
 *         {
 *           "template_name": "sale_announcement",
 *           "language": "en_US",
 *           "phone_messages": [
 *             {
 *               "phone_number": "5511999999999",
 *               "variables": [
 *                 {
 *                   "type": "header",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "December 1st"
 *                     }
 *                   ]
 *                 },
 *                 {
 *                   "type": "body",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "50"
 *                     },
 *                     {
 *                       "type": "text",
 *                       "text": "December 31st"
 *                     }
 *                   ]
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *
 *       - Send a template message with named parameters:
 *         `POST /message/template`
 *         Body:
 *         {
 *           "template_name": "sale_announcement_named",
 *           "language": "en_US",
 *           "phone_messages": [
 *             {
 *               "phone_number": "5511999999999",
 *               "variables": [
 *                 {
 *                   "type": "header",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "December 1st",
 *                       "parameter_name": "sales_start_date"
 *                     }
 *                   ]
 *                 },
 *                 {
 *                   "type": "body",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "50",
 *                       "parameter_name": "discount"
 *                     },
 *                     {
 *                       "type": "text",
 *                       "text": "December 31st",
 *                       "parameter_name": "expiration_date"
 *                     }
 *                   ]
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *
 *       - Send a template message with CTA button:
 *         `POST /message/template`
 *         Body:
 *         {
 *           "template_name": "sale_announcement_positional",
 *           "language": "en_US",
 *           "phone_messages": [
 *             {
 *               "phone_number": "5511999999999",
 *               "variables": [
 *                 {
 *                   "type": "header",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "December 1st"
 *                     }
 *                   ]
 *                 },
 *                 {
 *                   "type": "body",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "50"
 *                     },
 *                     {
 *                       "type": "text",
 *                       "text": "December 31st"
 *                     }
 *                   ]
 *                 },
 *                 {
 *                   "type": "button",
 *                   "index": "0",
 *                   "sub_type": "url",
 *                   "parameters": [
 *                     {
 *                       "type": "text",
 *                       "text": "50"
 *                     },
 *                     {
 *                       "type": "text",
 *                       "text": "1234565"
 *                     }
 *                   ]
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *
 *       - Send a template message with media header:
 *         `POST /message/template`
 *         Body:
 *         {
 *           "template_name": "sale_announcement_media",
 *           "language": "en_US",
 *           "phone_messages": [
 *             {
 *               "phone_number": "5511999999999",
 *               "variables": [
 *                 {
 *                   "type": "header",
 *                   "parameters": [
 *                     {
 *                       "type": "image",
 *                       "image": {
 *                         "link": "https://bucket.ember.app.br/files/document_sample.pdf"
 *                       }
 *                     }
 *                   ]
 *                 }
 *               ]
 *             }
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
 *                       type: array
 *                       description: Array of variable components for template (header, body, button, etc.).
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: Component type (header, body, button, footer)
 *                             example: 'header'
 *                           parameters:
 *                             type: array
 *                             description: Parameters for the component
 *                             items:
 *                               type: object
 *                               properties:
 *                                 type:
 *                                   type: string
 *                                   description: Parameter type (text, image, document, video)
 *                                   example: 'text'
 *                                 text:
 *                                   type: string
 *                                   description: Text value for text parameters
 *                                   example: 'December 1st'
 *                                 parameter_name:
 *                                   type: string
 *                                   description: Parameter name for named parameters (optional)
 *                                   example: 'sales_start_date'
 *                                 image:
 *                                   type: object
 *                                   description: Image object for image parameters (optional)
 *                                   properties:
 *                                     link:
 *                                       type: string
 *                                       description: URL of the image
 *                                       example: 'https://bucket.ember.app.br/files/image.jpg'
 *                                 index:
 *                                   type: string
 *                                   description: Button index for button parameters (optional)
 *                                   example: '0'
 *                                 sub_type:
 *                                   type: string
 *                                   description: Button sub-type for button parameters (optional)
 *                                   example: 'url'
 *           example:
 *             template_name: "sale_announcement"
 *             language: "en_US"
 *             phone_messages:
 *               - phone_number: "5511999999999"
 *                 variables:
 *                   - type: "header"
 *                     parameters:
 *                       - type: "text"
 *                         text: "December 1st"
 *                   - type: "body"
 *                     parameters:
 *                       - type: "text"
 *                         text: "50"
 *                       - type: "text"
 *                         text: "December 31st"
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

        const normalizeBrazilianPhoneNumber = (fromPhoneNumber) => {
            if (!fromPhoneNumber || typeof fromPhoneNumber !== 'string') {
                return fromPhoneNumber;
            }

            const digitsOnly = fromPhoneNumber.replace(/\D/g, '');

            if (digitsOnly.length === 12 && digitsOnly.startsWith('55')) {
                const normalized = digitsOnly.slice(0, 4) + '9' + digitsOnly.slice(4);
                return normalized;
            }
            return digitsOnly;
        }

        campaignName = campaignName || `Campaign ${new Date().toISOString().replace('T', ' ').replace('Z', '')}`;

        if (!template_name || !phone_messages || !Array.isArray(phone_messages) || !language) {
            return res.status(400).json({ error: 'Invalid input: template_name, phone_messages array, and language are required' });
        }


        const phone_numbers = phone_messages.map(msg => normalizeBrazilianPhoneNumber(msg.phone_number));
        const variablesList = phone_messages.map(msg => msg.variables || {});

        const result = await messageService.sendTemplateMessages({
            wabaId,
            apiToken,
            template_name,
            phone_numbers,
            variablesList,
            phoneId,
            languageCode: language,
            fromPhoneNumber: fromPhoneNumber,
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