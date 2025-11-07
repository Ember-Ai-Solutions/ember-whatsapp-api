const express = require('express');
const analyticsService = require('../services/analyticsService');
const dashboardService = require('../services/dashboardService');
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

/**
 * @swagger
 * /dashboard:
 *   post:
 *     summary: Create a new dashboard
 *     description: |
 *       Create a new dashboard with reports containing metrics and filters.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - Each dashboard can have multiple reports.
 *       - Each report must have at least one metric with a type.
 *       - Position must be unique and sequential (1, 2, 3... no gaps).
 *       - If position is not provided, it will be auto-generated.
 *       - Report _id is auto-generated if not provided.
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
 *             properties:
 *               reports:
 *                 type: array
 *                 description: Array of reports (optional, can be empty array or omitted for empty dashboard)
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - type
 *                     - metrics
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Report ID (auto-generated if not provided)
 *                       example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *                     position:
 *                       type: integer
 *                       description: Position of the report (auto-generated if not provided, must be unique and sequential)
 *                       example: 1
 *                     name:
 *                       type: string
 *                       description: Name of the report (required)
 *                       example: "Monthly Report"
 *                     type:
 *                       type: string
 *                       enum: [number, pie, bar]
 *                       description: Type of the report visualization (required)
 *                       example: "number"
 *                     size:
 *                       type: string
 *                       description: Size of the report (optional, defaults to "medium")
 *                       example: "medium"
 *                     metrics:
 *                       type: array
 *                       description: Array of metrics for this report (required, must have at least one)
 *                       items:
 *                         type: object
 *                         required:
 *                           - type
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [messagesSent, campaignsTotal, replies, views, errors]
 *                             description: Type of metric
 *                             example: messagesSent
 *                           filter:
 *                             type: object
 *                             description: Optional metric-specific filters
 *                             properties:
 *                               text:
 *                                 type: string
 *                                 description: For replies metric, filter by exact text match (case-insensitive)
 *                                 example: sim
 *                     filters:
 *                       type: object
 *                       description: General filters to apply to all metrics in this report
 *                       properties:
 *                         dateRange:
 *                           type: array
 *                           items:
 *                             type: string
 *                             format: date
 *                           minItems: 2
 *                           maxItems: 2
 *                           description: Date range [start, end] in ISO 8601 format
 *                           example: ["2025-11-01", "2025-11-06"]
 *                         campaignId:
 *                           type: string
 *                           description: Filter by campaign ID
 *                           example: "507f1f77bcf86cd799439011"
 *                         campaignName:
 *                           type: string
 *                           description: Filter by campaign name
 *                           example: "Campaign 2025-11-01"
 *                         templateName:
 *                           type: string
 *                           description: Filter by template name
 *                           example: "welcome_template"
 *                         fromPhoneNumber:
 *                           type: string
 *                           description: Filter by sender phone number
 *                           example: "+15556287518"
 *           example:
 *             reports:
 *               - position: 1
 *                 name: "Monthly Report"
 *                 type: "number"
 *                 size: "medium"
 *                 metrics:
 *                   - type: messagesSent
 *                   - type: campaignsTotal
 *                   - type: replies
 *                   - type: views
 *                   - type: errors
 *                   - type: replies
 *                     filter:
 *                       text: sim
 *                   - type: replies
 *                     filter:
 *                       text: quero saber mais
 *                 filters:
 *                   dateRange: ["2025-11-01", "2025-11-06"]
 *                   campaignId: "507f1f77bcf86cd799439011"
 *                   templateName: "welcome_template"
 *     responses:
 *       201:
 *         description: Dashboard created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the created dashboard
 *                   example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Report at index 0: Report must have at least one metric with a type"
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
 *                   example: "Erro ao criar dashboard"
 *     security:
 *       - bearerAuth: []
 */
router.post('/dashboard', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { reports } = req.body;
        const { projectId } = req.body;

        // Validate reports if provided
        if (reports !== undefined && !Array.isArray(reports)) {
            return res.status(400).json({ error: 'Reports must be an array' });
        }

        // Create dashboard (reports can be empty array or undefined)
        const result = await dashboardService.createDashboard(projectId, { reports: reports || [] });

        res.status(201).json(result);
    } catch (error) {
        // Validation errors should return 400, other errors return 500
        const isValidationError = error.message.includes('must') || 
                                  error.message.includes('required') || 
                                  error.message.includes('invalid') ||
                                  error.message.includes('Position') ||
                                  error.message.includes('sequential');
        
        if (isValidationError) {
            logger.warn('AnalyticsRoute: Validation error in POST /dashboard', { error: error.message });
            return res.status(400).json({ error: error.message });
        }
        
        logger.error('AnalyticsRoute: Error in POST /dashboard', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao criar dashboard' });
    }
});

/**
 * @swagger
 * /dashboard/{id}:
 *   get:
 *     summary: Get dashboard by ID
 *     description: |
 *       Retrieve a dashboard by its ID. Verifies that the project from the JWT token has access to this dashboard.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - The dashboard ID must be in the project's dashboards array to access it.
 *
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the dashboard
 *         example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project. Required if using a user JWT. Not required for service JWT.
 *     responses:
 *       200:
 *         description: Dashboard retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the dashboard
 *                   example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *                 reports:
 *                   type: array
 *                   description: Array of reports in the dashboard
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Report ID
 *                       position:
 *                         type: integer
 *                         description: Position of the report
 *                       name:
 *                         type: string
 *                         description: Name of the report
 *                       type:
 *                         type: string
 *                         enum: [number, pie, bar]
 *                         description: Type of the report visualization
 *                       size:
 *                         type: string
 *                         description: Size of the report
 *                       metrics:
 *                         type: array
 *                         description: Array of metrics
 *                       filters:
 *                         type: object
 *                         description: Filters for the report
 *       400:
 *         description: Invalid input. Dashboard ID or Project ID is missing.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Dashboard ID is required"
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
 *       403:
 *         description: Forbidden. Project does not have access to this dashboard.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Access denied: Project does not have access to this dashboard"
 *       404:
 *         description: Dashboard or Project not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Dashboard not found"
 *       500:
 *         description: Internal server error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erro ao buscar dashboard"
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard/:id', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { id: dashboardId } = req.params;
        const { projectId } = req.body;

        if (!dashboardId) {
            return res.status(400).json({ error: 'Dashboard ID is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Get dashboard and verify access
        const dashboard = await dashboardService.getDashboardById(dashboardId, projectId);

        res.status(200).json(dashboard);
    } catch (error) {
        // Handle specific error types
        if (error.message === 'Dashboard ID is required' || error.message === 'Project ID is required') {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message === 'Project not found' || error.message === 'Dashboard not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: error.message });
        }
        
        logger.error('AnalyticsRoute: Error in GET /dashboard/:id', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao buscar dashboard' });
    }
});

/**
 * @swagger
 * /dashboard/{id}:
 *   put:
 *     summary: Update dashboard
 *     description: |
 *       Update a dashboard's reports. Verifies that the project from the JWT token has access to this dashboard.
 *       Can update the types and positions of each report.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - The dashboard ID must be in the project's dashboards array to access it.
 *       - Reports will be validated and normalized (positions must be unique and sequential).
 *
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the dashboard
 *         example: "64b8f0f2e1d3c8a1f0a1b2c3"
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
 *             properties:
 *               reports:
 *                 type: array
 *                 description: Array of reports to update (replaces existing reports)
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - type
 *                     - metrics
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Report ID (auto-generated if not provided)
 *                       example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *                     position:
 *                       type: integer
 *                       description: Position of the report (auto-generated if not provided, must be unique and sequential)
 *                       example: 1
 *                     name:
 *                       type: string
 *                       description: Name of the report (required)
 *                       example: "Monthly Report"
 *                     type:
 *                       type: string
 *                       enum: [number, pie, bar]
 *                       description: Type of the report visualization (required)
 *                       example: "number"
 *                     size:
 *                       type: string
 *                       description: Size of the report (optional, defaults to "medium")
 *                       example: "medium"
 *                     metrics:
 *                       type: array
 *                       description: Array of metrics for this report (required, must have at least one)
 *                       items:
 *                         type: object
 *                         required:
 *                           - type
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [messagesSent, campaignsTotal, replies, views, errors]
 *                             description: Type of metric
 *                             example: messagesSent
 *                           filter:
 *                             type: object
 *                             description: Optional metric-specific filters
 *                             properties:
 *                               text:
 *                                 type: string
 *                                 description: For replies metric, filter by exact text match (case-insensitive)
 *                                 example: sim
 *                     filters:
 *                       type: object
 *                       description: General filters to apply to all metrics in this report
 *                       properties:
 *                         dateRange:
 *                           type: array
 *                           items:
 *                             type: string
 *                             format: date
 *                           minItems: 2
 *                           maxItems: 2
 *                           description: Date range [start, end] in ISO 8601 format
 *                           example: ["2025-11-01", "2025-11-06"]
 *                         campaignId:
 *                           type: string
 *                           description: Filter by campaign ID
 *                           example: "507f1f77bcf86cd799439011"
 *                         campaignName:
 *                           type: string
 *                           description: Filter by campaign name
 *                           example: "Campaign 2025-11-01"
 *                         templateName:
 *                           type: string
 *                           description: Filter by template name
 *                           example: "welcome_template"
 *                         fromPhoneNumber:
 *                           type: string
 *                           description: Filter by sender phone number
 *                           example: "+15556287518"
 *           example:
 *             reports:
 *               - position: 1
 *                 name: "Monthly Report"
 *                 type: "number"
 *                 size: "medium"
 *                 metrics:
 *                   - type: messagesSent
 *                   - type: campaignsTotal
 *               - position: 2
 *                 name: "Replies Report"
 *                 type: "pie"
 *                 size: "large"
 *                 metrics:
 *                   - type: replies
 *                     filter:
 *                       text: sim
 *                 filters:
 *                   dateRange: ["2025-11-01", "2025-11-06"]
 *     responses:
 *       200:
 *         description: Dashboard updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the dashboard
 *                   example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *                 reports:
 *                   type: array
 *                   description: Updated array of reports
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Report at index 0: Report must have at least one metric with a type"
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
 *       403:
 *         description: Forbidden. Project does not have access to this dashboard.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Access denied: Project does not have access to this dashboard"
 *       404:
 *         description: Dashboard or Project not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Dashboard not found"
 *       500:
 *         description: Internal server error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erro ao atualizar dashboard"
 *     security:
 *       - bearerAuth: []
 */
router.put('/dashboard/:id', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { id: dashboardId } = req.params;
        const { reports } = req.body;
        const { projectId } = req.body;

        if (!dashboardId) {
            return res.status(400).json({ error: 'Dashboard ID is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Validate reports if provided
        if (reports !== undefined && !Array.isArray(reports)) {
            return res.status(400).json({ error: 'Reports must be an array' });
        }

        // Update dashboard
        const dashboard = await dashboardService.updateDashboard(dashboardId, projectId, { reports });

        res.status(200).json(dashboard);
    } catch (error) {
        // Handle specific error types
        if (error.message === 'Dashboard ID is required' || error.message === 'Project ID is required') {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message === 'Project not found' || error.message === 'Dashboard not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: error.message });
        }

        // Validation errors should return 400
        const isValidationError = error.message.includes('must') || 
                                  error.message.includes('required') || 
                                  error.message.includes('invalid') ||
                                  error.message.includes('Position') ||
                                  error.message.includes('sequential') ||
                                  error.message.includes('Reports must be');
        
        if (isValidationError) {
            logger.warn('AnalyticsRoute: Validation error in PUT /dashboard/:id', { error: error.message });
            return res.status(400).json({ error: error.message });
        }
        
        logger.error('AnalyticsRoute: Error in PUT /dashboard/:id', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao atualizar dashboard' });
    }
});

/**
 * @swagger
 * /dashboard/{id}/report:
 *   post:
 *     summary: Add a report to dashboard
 *     description: |
 *       Add a new report to an existing dashboard. Verifies that the project from the JWT token has access to this dashboard.
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - The dashboard ID must be in the project's dashboards array to access it.
 *       - Position will be auto-generated if not provided (next sequential number).
 *       - Report _id will be auto-generated if not provided.
 *
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the dashboard
 *         example: "64b8f0f2e1d3c8a1f0a1b2c3"
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
 *               - type
 *               - metrics
 *             properties:
 *               position:
 *                 type: integer
 *                 description: Position of the report (auto-generated if not provided)
 *                 example: 1
 *               name:
 *                 type: string
 *                 description: Name of the report (required)
 *                 example: "Monthly Report"
 *               type:
 *                 type: string
 *                 enum: [number, pie, bar]
 *                 description: Type of the report visualization (required)
 *                 example: "number"
 *               size:
 *                 type: string
 *                 description: Size of the report (optional, defaults to "medium")
 *                 example: "medium"
 *               metrics:
 *                 type: array
 *                 description: Array of metrics for this report (required, must have at least one)
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [messagesSent, campaignsTotal, replies, views, errors]
 *                       description: Type of metric
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
 *                 description: General filters to apply to all metrics in this report
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
 *             name: "Monthly Report"
 *             type: "number"
 *             size: "medium"
 *             metrics:
 *               - type: messagesSent
 *               - type: campaignsTotal
 *             filters:
 *               dateRange: ["2025-11-01", "2025-11-06"]
 *     responses:
 *       200:
 *         description: Report added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the dashboard
 *                 reports:
 *                   type: array
 *                   description: Updated array of reports
 *       400:
 *         description: Invalid input. Required fields are missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Report must have at least one metric with a type"
 *       401:
 *         description: Unauthorized. JWT is missing, invalid, or does not have the required role.
 *       403:
 *         description: Forbidden. Project does not have access to this dashboard.
 *       404:
 *         description: Dashboard or Project not found.
 *       500:
 *         description: Internal server error.
 *     security:
 *       - bearerAuth: []
 */
router.post('/dashboard/:id/report', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { id: dashboardId } = req.params;
        const reportData = req.body;
        const { projectId } = req.body;

        if (!dashboardId) {
            return res.status(400).json({ error: 'Dashboard ID is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Add report to dashboard
        const dashboard = await dashboardService.addReportToDashboard(dashboardId, projectId, reportData);

        res.status(200).json(dashboard);
    } catch (error) {
        // Handle specific error types
        if (error.message === 'Dashboard ID is required' || error.message === 'Project ID is required') {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message === 'Project not found' || error.message === 'Dashboard not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: error.message });
        }

        // Validation errors should return 400
        const isValidationError = error.message.includes('must') || 
                                  error.message.includes('required') || 
                                  error.message.includes('invalid') ||
                                  error.message.includes('Position') ||
                                  error.message.includes('sequential');
        
        if (isValidationError) {
            logger.warn('AnalyticsRoute: Validation error in POST /dashboard/:id/report', { error: error.message });
            return res.status(400).json({ error: error.message });
        }
        
        logger.error('AnalyticsRoute: Error in POST /dashboard/:id/report', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao adicionar report' });
    }
});

/**
 * @swagger
 * /dashboard/{id}/report/{reportId}:
 *   delete:
 *     summary: Remove a report from dashboard
 *     description: |
 *       Remove a report from an existing dashboard. Verifies that the project from the JWT token has access to this dashboard.
 *       After removal, positions will be re-normalized to be sequential (1, 2, 3...).
 *
 *       - Requires JWT authentication with at least 'viewer' role for the project.
 *       - The **`projectId`** parameter is required in query string for user JWTs (not required for service JWTs).
 *       - The dashboard ID must be in the project's dashboards array to access it.
 *
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the dashboard
 *         example: "64b8f0f2e1d3c8a1f0a1b2c3"
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the report to remove
 *         example: "64b8f0f2e1d3c8a1f0a1b2c4"
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Unique identifier of the project. Required if using a user JWT. Not required for service JWT.
 *     responses:
 *       200:
 *         description: Report removed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the dashboard
 *                 reports:
 *                   type: array
 *                   description: Updated array of reports (with re-normalized positions)
 *       400:
 *         description: Invalid input. Dashboard ID, Report ID or Project ID is missing.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Report ID is required"
 *       401:
 *         description: Unauthorized. JWT is missing, invalid, or does not have the required role.
 *       403:
 *         description: Forbidden. Project does not have access to this dashboard.
 *       404:
 *         description: Dashboard, Project or Report not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Report not found"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erro ao remover report"
 *     security:
 *       - bearerAuth: []
 */
router.delete('/dashboard/:id/report/:reportId', jwtTokenValidation('viewer'), async (req, res) => {
    try {
        const { id: dashboardId, reportId } = req.params;
        const { projectId } = req.body;

        if (!dashboardId) {
            return res.status(400).json({ error: 'Dashboard ID is required' });
        }

        if (!reportId) {
            return res.status(400).json({ error: 'Report ID is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Remove report from dashboard
        const dashboard = await dashboardService.removeReportFromDashboard(dashboardId, projectId, reportId);

        res.status(200).json(dashboard);
    } catch (error) {
        // Handle specific error types
        if (error.message === 'Dashboard ID is required' || 
            error.message === 'Project ID is required' || 
            error.message === 'Report ID is required') {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message === 'Project not found' || 
            error.message === 'Dashboard not found' || 
            error.message === 'Report not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: error.message });
        }
        
        logger.error('AnalyticsRoute: Error in DELETE /dashboard/:id/report/:reportId', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Erro ao remover report' });
    }
});

module.exports = router;

