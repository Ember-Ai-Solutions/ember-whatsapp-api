const express = require('express');
const templateService = require('../services/templateService');
const metaService = require('../services/metaService');
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
 *       - `category`: Category of the template (e.g., UTILITY, MARKETING). (required)
 *       - `language`: Language code for the template (e.g., en_US, pt_BR). (required)
 *       - `components`: Components of the template (body, header, footer, buttons, etc). (required)
 *       - `parameter_format`: Format for template parameters (positional, named) (optional).
 *
 *       **Component Types:**
 *       - **HEADER**: Text, image, video, or document header
 *         - `type`: "header"
 *         - `format`: "text" | "image" | "video" | "document"
 *         - `text`: Text content (for text format)
 *         - `example`: Example values for variables
 *           - For positional parameters: `{"header_text": ["value"]}`
 *           - For named parameters: `{"header_text_named_params": [{"param_name": "name", "example": "value"}]}`
 *       - **BODY**: Main message content
 *         - `type`: "body"
 *         - `text`: Text content with variables {{1}}, {{2}}, etc. or {{variable_name}}
 *         - `example`: Example values for variables
 *           - For positional parameters: `{"body_text": ["value1", "value2", "value3"]}`
 *           - For named parameters: `{"body_text_named_params": [{"param_name": "name1", "example": "value1"}, {"param_name": "name2", "example": "value2"}]}`
 *       - **FOOTER**: Footer text
 *         - `type`: "footer"
 *         - `text`: Footer text content
 *       - **BUTTONS**: Interactive buttons
 *         - `type`: "BUTTONS"
 *         - `buttons`: Array of button objects
 *           - `type`: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
 *           - `text`: Button text
 *           - `phone_number`: Phone number for PHONE_NUMBER type
 *           - `url`: URL for URL type (can include variables like {{1}})
 *           - `example`: Array of example values for URL variables
 *
 *       **Examples:**
 *       - Create a template with positional parameters:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "sale_announcement",
 *           "category": "MARKETING",
 *           "language": "en_US",
 *           "components": [
 *             {
 *               "type": "HEADER",
 *               "format": "TEXT",
 *               "text": "Our new sale starts {{1}}!",
 *               "example": {
 *                 "header_text": [
 *                   "December 1st"
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "BODY",
 *               "text": "Get up to {{1}}% off on all items. Valid until {{2}}.",
 *               "example": {
 *                 "body_text": [
 *                   [
 *                     "50",
 *                     "December 31st"
 *                   ]
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "FOOTER",
 *               "text": "Don't miss out on these amazing deals!"
 *             }
 *           ],
 *           "parameter_format": "positional"
 *         }
 *
 *       - Create a template with media header:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "sale_announcement_media",
 *           "category": "MARKETING",
 *           "language": "en_US",
 *           "components": [
 *             {
 *               "type": "HEADER",
 *               "format": "DOCUMENT",
 *               "example": {
 *                 "header_handle": [
 *                   "https://bucket.ember.app.br/files/document-sample.pdf"
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "BODY",
 *               "text": "Get up to 50% off on all items. Valid until tomorrow."
 *             },
 *             {
 *               "type": "FOOTER",
 *               "text": "Don't miss out on these amazing deals!"
 *             }
 *           ],
 *           "parameter_format": "positional"
 *         }
 *
 *       - Create a template with named parameters:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "sale_announcement_named",
 *           "category": "MARKETING",
 *           "language": "en_US",
 *           "components": [
 *             {
 *               "type": "HEADER",
 *               "format": "TEXT",
 *               "text": "Our new sale starts {{sale_start_date}}!",
 *               "example": {
 *                 "header_text_named_params": [
 *                   {
 *                     "param_name": "sale_start_date",
 *                     "example": "December 1st"
 *                   }
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "BODY",
 *               "text": "Get up to {{discount}}% off on all items. Valid until {{expiration_date}}.",
 *               "example": {
 *                 "body_text_named_params": [
 *                   {
 *                     "param_name": "discount",
 *                     "example": "50"
 *                   },
 *                   {
 *                     "param_name": "expiration_date",
 *                     "example": "December 31st"
 *                   }
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "FOOTER",
 *               "text": "Don't miss out on these amazing deals!"
 *             }
 *           ],
 *           "parameter_format": "named"
 *         }
 *
 *       - Create a template with CTA buttons:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "sale_announcement_positional",
 *           "category": "MARKETING",
 *           "language": "en_US",
 *           "components": [
 *             {
 *               "type": "HEADER",
 *               "format": "TEXT",
 *               "text": "Our new sale starts {{1}}!",
 *               "example": {
 *                 "header_text": [
 *                   "December 1st"
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "BODY",
 *               "text": "Get up to {{1}}% off on all items. Valid until {{2}}.",
 *               "example": {
 *                 "body_text": [
 *                   [
 *                     "50",
 *                     "December 31st"
 *                   ]
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "FOOTER",
 *               "text": "Don't miss out on these amazing deals!"
 *             },
 *             {
 *               "type": "BUTTONS",
 *               "buttons": [
 *                 {
 *                   "type": "PHONE_NUMBER",
 *                   "text": "Call",
 *                   "phone_number": "15550051310"
 *                 },
 *                 {
 *                   "type": "URL",
 *                   "text": "Shop Now",
 *                   "url": "https://www.luckyshrub.com/shop/{{1}}",
 *                   "example": [
 *                     "123456"
 *                   ]
 *                 }
 *               ]
 *             }
 *           ],
 *           "parameter_format": "positional"
 *         }
 *
 *       - Create a template with quick reply buttons:
 *         `POST /template`
 *         Body:
 *         {
 *           "name": "sale_announcement_buttons",
 *           "category": "MARKETING",
 *           "language": "en_US",
 *           "components": [
 *             {
 *               "type": "HEADER",
 *               "format": "TEXT",
 *               "text": "Our new sale starts {{1}}!",
 *               "example": {
 *                 "header_text": [
 *                   "December 1st"
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "BODY",
 *               "text": "Get up to {{1}}% off on all items. Valid until {{2}}.",
 *               "example": {
 *                 "body_text": [
 *                   [
 *                     "50",
 *                     "December 31st"
 *                   ]
 *                 ]
 *               }
 *             },
 *             {
 *               "type": "FOOTER",
 *               "text": "Don't miss out on these amazing deals!"
 *             },
 *             {
 *               "type": "BUTTONS",
 *               "buttons": [
 *                 {
 *                   "type": "QUICK_REPLY",
 *                   "text": "Let's go!"
 *                 },
 *                 {
 *                   "type": "QUICK_REPLY",
 *                   "text": "Buy now"
 *                 },
 *                 {
 *                   "type": "QUICK_REPLY",
 *                   "text": "Unsubscribe"
 *                 }
 *               ]
 *             }
 *           ],
 *           "parameter_format": "positional"
 *         }
 *
 *       **Component Examples:**
 *       - Header with positional parameters:
 *         ```json
 *         {
 *           "type": "HEADER",
 *           "format": "TEXT",
 *           "text": "Our new sale starts {{1}}!",
 *           "example": {
 *             "header_text": [
 *               "December 1st"
 *             ]
 *           }
 *         }
 *         ```
 *
 *       - Header with named parameters:
 *         ```json
 *         {
 *           "type": "HEADER",
 *           "format": "TEXT",
 *           "text": "Our new sale starts {{sale_start_date}}!",
 *           "example": {
 *             "header_text_named_params": [
 *               {
 *                 "param_name": "sale_start_date",
 *                 "example": "December 1st"
 *               }
 *             ]
 *           }
 *         }
 *         ```
 *
 *       - Body with positional parameters:
 *         ```json
 *         {
 *           "type": "BODY",
 *           "text": "Shop now through {{1}} and use code {{2}} to get {{3}} off of all merchandise.",
 *           "example": {
 *             "body_text": [
 *               "the end of August","25OFF","25%"
 *             ]
 *           }
 *         }
 *         ```
 *
 *       - Body with named parameters:
 *         ```json
 *         {
 *           "type": "BODY",
 *           "text": "Your {{order_id}}, is ready {{customer_name}}.",
 *           "example": {
 *             "body_text_named_params": [
 *               {
 *                 "param_name": "order_id",
 *                 "example": "335628"
 *               },
 *               {
 *                 "param_name": "customer_name",
 *                 "example": "Shiva"
 *               }
 *             ]
 *           }
 *         }
 *         ```
 *
 *       - Buttons with quick replies:
 *         ```json
 *         {
 *           "type": "BUTTONS",
 *           "buttons": [
 *             {
 *               "type": "QUICK_REPLY",
 *               "text": "Let's go!"
 *             },
 *             {
 *               "type": "QUICK_REPLY",
 *               "text": "Buy now"
 *             },
 *             {
 *               "type": "QUICK_REPLY",
 *               "text": "Unsubscribe"
 *             }
 *           ]
 *         }
 *         ```
 *
 *       - Buttons with CTA actions:
 *         ```json
 *         {
 *           "type": "BUTTONS",
 *           "buttons": [
 *             {
 *               "type": "PHONE_NUMBER",
 *               "text": "Call",
 *               "phone_number": "15550051310"
 *             },
 *             {
 *               "type": "URL",
 *               "text": "Shop Now",
 *               "url": "https://www.luckyshrub.com/shop/{{1}}",
 *               "example": [
 *                 "123456"
 *               ]
 *             }
 *           ]
 *         }
 *         ```
 *
 *       - Header with media:
 *         ```json
 *         {
 *           "type": "HEADER",
 *           "format": "DOCUMENT",
 *           "example": {
 *             "header_handle": [
 *               "https://bucket.ember.app.br/files/document-sample.pdf"
 *             ]
 *           }
 *         }
 *         ```
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
 *                 example: order_confirmation
 *               category:
 *                 type: string
 *                 description: Category of the template (e.g., UTILITY, MARKETING).
 *                 example: UTILITY
 *               language:
 *                 type: string
 *                 description: Language code for the template (e.g., en_US, pt_BR).
 *                 example: pt_BR
 *               components:
 *                 type: array
 *                 description: Components of the template (body, header, footer, buttons, etc).
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       description: Component type (HEADER, BODY, FOOTER, BUTTONS)
 *                       example: HEADER
 *                     format:
 *                       type: string
 *                       description: Format for header component (text, image, video, document)
 *                       example: text
 *                     text:
 *                       type: string
 *                       description: Text content for the component
 *                       example: "Pedido Confirmado"
 *                     sub_type:
 *                       type: string
 *                       description: Sub-type for button component (quick_reply, url, phone_number)
 *                       example: quick_reply
 *                     index:
 *                       type: integer
 *                       description: Button position (0-2)
 *                       example: 0
 *                     example:
 *                       type: object
 *                       description: Example values for the component
 *                       properties:
 *                         header_text:
 *                           type: array
 *                           description: Example values for header text
 *                         header_text_named_params:
 *                           type: array
 *                           description: Example values for named header parameters
 *                         body_text:
 *                           type: array
 *                           description: Example values for body text
 *                         body_text_named_params:
 *                           type: array
 *                           description: Example values for named body parameters
 *                         header_handle:
 *                           type: array
 *                           description: Example media handles for header
 *                     buttons:
 *                       type: array
 *                       description: Array of buttons for BUTTONS component
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: Button type (QUICK_REPLY, URL, PHONE_NUMBER)
 *                             example: QUICK_REPLY
 *                           text:
 *                             type: string
 *                             description: Button text
 *                             example: "Let's go!"
 *                           phone_number:
 *                             type: string
 *                             description: Phone number for PHONE_NUMBER buttons
 *                             example: "15550051310"
 *                           url:
 *                             type: string
 *                             description: URL for URL buttons (can include variables)
 *                             example: "https://www.luckyshrub.com/shop/{{1}}"
 *                           example:
 *                             type: array
 *                             description: Example values for URL variables
 *                             example: ["123456"]
 *               parameter_format:
 *                 type: string
 *                 description: Format for template parameters (optional).
 *                 example: positional
 *           example:
 *             name: "sale_announcement"
 *             category: "MARKETING"
 *             language: "en_US"
 *             components:
 *               - type: "HEADER"
 *                 format: "TEXT"
 *                 text: "Our new sale starts {{1}}!"
 *                 example:
 *                   header_text:
 *                     - "December 1st"
 *               - type: "BODY"
 *                 text: "Get up to {{1}}% off on all items. Valid until {{2}}."
 *                 example:
 *                   body_text:
 *                     - ["50", "December 31st"]
 *               - type: "FOOTER"
 *                 text: "Don't miss out on these amazing deals!"
 *               - type: "BUTTONS"
 *                 buttons:
 *                   - type: "QUICK_REPLY"
 *                     text: "Let's go!"
 *                   - type: "QUICK_REPLY"
 *                     text: "Buy now"
 *             parameter_format: "positional"
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
 *                   example: order_confirmation
 *                 content:
 *                   type: string
 *                   example: Pedido Confirmado
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
        const { wabaId, apiToken, appId } = req.body;
        const { name, category, language, components, parameter_format } = req.body;
        if (!name || !category || !language || !components) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        for (const component of components) {
            if (component.type === 'HEADER' && (component.format === 'IMAGE' || component.format === 'VIDEO' || component.format === 'DOCUMENT')) {
                const fileHandle = await metaService.uploadMediaFromUrl({ appId, accessToken: apiToken, fileUrl: component.example.header_handle[0] });
                component.example.header_handle[0] = fileHandle.h;
            }
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