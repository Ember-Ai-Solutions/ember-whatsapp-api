const express = require('express');
const analyticsService = require('../services/analyticsService');
const logger = require('../config/logger');
const { jwtTokenValidation } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /stats:
 *   post:
 *     summary: Get dynamic analytics statistics
 *     description: |
 *       Retrieve dynamic analytics statistics based on requested metrics and filters.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - Processes all metrics in parallel for better performance.
 *       - Unknown metric types are silently ignored.
 *
 *       **Metric Types:**
 *       - `messagesSent`: Total number of messages sent across all campaigns
 *       - `campaignsTotal`: Total number of campaigns
 *       - `replies`: Total number of unique clients who replied (can filter by text)
 *       - `views`: Total number of unique clients who viewed messages (readDateTime exists)
 *       - `errors`: Total number of failed message sends
 *
 *       **Filters:**
 *       - `dateRange`: Array with two dates [start, end] in ISO 8601 format
 *       - `campaignId`: Filter by specific campaign ID
 *       - `campaignName`: Filter by campaign name
 *       - `templateName`: Filter by template name
 *       - `fromPhoneNumber`: Filter by sender phone number
 *
 *       **Metric-specific Filters:**
 *       - For `replies` metric, you can provide a `filter.text` to count only replies containing that exact text (case-insensitive)
 *
 *     tags:
 *       - Analytics
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
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: array
 *                 description: List of metrics to calculate
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [messagesSent, campaignsTotal, replies, views, errors]
 *                       description: Type of metric to calculate
 *                       example: messagesSent
 *                     filter:
 *                       type: object
 *                       description: Optional metric-specific filters
 *                       properties:
 *                         text:
 *                           type: string
 *                           description: For replies metric, filter by exact text match (case-insensitive)
 *                           example: sim
 *               filters:
 *                 type: object
 *                 description: General filters to apply to all metrics
 *                 properties:
 *                   dateRange:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: date
 *                     minItems: 2
 *                     maxItems: 2
 *                     description: Date range [start, end] in ISO 8601 format
 *                     example: ["2025-11-01", "2025-11-06"]
 *                   campaignId:
 *                     type: string
 *                     description: Filter by campaign ID
 *                     example: "507f1f77bcf86cd799439011"
 *                   campaignName:
 *                     type: string
 *                     description: Filter by campaign name
 *                     example: "Campaign 2025-11-01"
 *                   templateName:
 *                     type: string
 *                     description: Filter by template name
 *                     example: "welcome_template"
 *                   fromPhoneNumber:
 *                     type: string
 *                     description: Filter by sender phone number
 *                     example: "+15556287518"
 *           example:
 *             metrics:
 *               - type: messagesSent
 *               - type: campaignsTotal
 *               - type: replies
 *                 filter:
 *                   text: sim
 *               - type: replies
 *                 filter:
 *                   text: quero saber mais
 *             filters:
 *               dateRange: ["2025-11-01", "2025-11-06"]
 *               campaignId: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Statistics calculated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               description: Object with metric keys and their calculated values
 *               example:
 *                 messagesSent: 1542
 *                 campaignsTotal: 12
 *                 replies:sim: 87
 *                 replies:quero saber mais: 14
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid input: metrics array is required"
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
 *                   example: "Erro ao gerar estatísticas"
 *     security:
 *       - bearerAuth: []
 */
router.post('/stats', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { metrics, filters = {} } = req.body;
        const { projectId } = req.body;

        // Validate required fields
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
            return res.status(400).json({ error: 'Invalid input: metrics array is required' });
        }

        // Validate each metric has a type
        const invalidMetrics = metrics.filter(m => !m || !m.type);
        if (invalidMetrics.length > 0) {
            return res.status(400).json({ error: 'Invalid input: all metrics must have a type field' });
        }

        // Process metrics
        const stats = await analyticsService.processMetrics(projectId, metrics, filters);

        res.status(200).json(stats);
    } catch (error) {
        logger.error('AnalyticsRoute: Error in POST /stats', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao gerar estatísticas' });
    }
});

module.exports = router;

