const mongodbService = require('./mongodbService');
const environment = require('../config/environment');
const logger = require('../config/logger');

const WEBSITE_DB_NAME = 'website';
const DASHBOARDS_COLLECTION_NAME = 'dashboards';
const CLIENTS_DB_NAME = environment.mongoClientsDbName;
const PROJECTS_COLLECTION_NAME = environment.mongoProjectsCollectionName;

/**
 * Validate report structure
 */
function validateReport(report, existingPositions = []) {
    const errors = [];

    // Validate metrics
    if (!report.metrics || !Array.isArray(report.metrics) || report.metrics.length === 0) {
        errors.push('Report must have at least one metric with a type');
    } else {
        report.metrics.forEach((metric, index) => {
            if (!metric.type) {
                errors.push(`Metric at index ${index} must have a type`);
            }
            // Validate metric types
            const validTypes = ['messagesSent', 'campaignsTotal', 'replies', 'views', 'errors'];
            if (metric.type && !validTypes.includes(metric.type)) {
                errors.push(`Invalid metric type: ${metric.type} at index ${index}`);
            }
        });
    }

    // Validate position if provided
    if (report.position !== undefined) {
        if (!Number.isInteger(report.position) || report.position < 1) {
            errors.push('Position must be a positive integer');
        }
        if (existingPositions.includes(report.position)) {
            errors.push(`Position ${report.position} already exists`);
        }
    }

    return errors;
}

/**
 * Get next available position for reports
 */
function getNextPosition(existingPositions) {
    if (existingPositions.length === 0) {
        return 1;
    }
    
    const sortedPositions = [...existingPositions].sort((a, b) => a - b);
    
    // Find first gap or return next number
    for (let i = 0; i < sortedPositions.length; i++) {
        if (sortedPositions[i] !== i + 1) {
            return i + 1;
        }
    }
    
    return sortedPositions.length + 1;
}

/**
 * Validate and normalize reports
 */
function normalizeReports(reports) {
    if (!Array.isArray(reports)) {
        throw new Error('Reports must be an array');
    }

    const existingPositions = [];
    const normalizedReports = [];

    reports.forEach((report, index) => {
        const errors = validateReport(report, existingPositions);
        if (errors.length > 0) {
            throw new Error(`Report at index ${index}: ${errors.join(', ')}`);
        }

        // Generate _id if not provided
        const reportId = report._id || new mongodbService.ObjectId();
        
        // Generate position if not provided
        let position = report.position;
        if (position === undefined) {
            position = getNextPosition(existingPositions);
        }
        
        existingPositions.push(position);

        normalizedReports.push({
            _id: typeof reportId === 'string' ? new mongodbService.ObjectId(reportId) : reportId,
            position: position,
            metrics: report.metrics || [],
            filters: report.filters || {}
        });
    });

    // Validate that positions are sequential starting from 1 (no gaps)
    if (normalizedReports.length > 0) {
        const sortedPositions = [...existingPositions].sort((a, b) => a - b);
        
        // Must start from 1
        if (sortedPositions[0] !== 1) {
            throw new Error('Positions must start from 1');
        }
        
        // Must be sequential without gaps
        for (let i = 0; i < sortedPositions.length; i++) {
            if (sortedPositions[i] !== i + 1) {
                throw new Error(`Positions must be sequential starting from 1. Found gap at position ${i + 1}`);
            }
        }
    }

    return normalizedReports;
}

/**
 * Create a new dashboard
 */
async function createDashboard(projectId, dashboardData) {
    try {
        const websiteDb = await mongodbService.getDbConnection(WEBSITE_DB_NAME);
        const dashboardsCollection = websiteDb.collection(DASHBOARDS_COLLECTION_NAME);

        // Generate dashboard _id
        const dashboardId = new mongodbService.ObjectId();

        // Normalize reports
        let reports = [];
        if (dashboardData.reports && Array.isArray(dashboardData.reports)) {
            reports = normalizeReports(dashboardData.reports);
        }

        // Create dashboard document
        const dashboard = {
            _id: dashboardId,
            reports: reports
        };

        // Insert dashboard
        await dashboardsCollection.insertOne(dashboard);

        // Add dashboard ID to project's dashboards array
        if (projectId) {
            try {
                const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
                const projectsCollection = clientsDb.collection(PROJECTS_COLLECTION_NAME);
                
                // Convert projectId to ObjectId if it's a string
                const projectObjectId = typeof projectId === 'string' 
                    ? new mongodbService.ObjectId(projectId) 
                    : projectId;
                
                // Add dashboard ID to project's dashboards array (using $addToSet to avoid duplicates)
                await projectsCollection.updateOne(
                    { _id: projectObjectId },
                    { 
                        $addToSet: { 
                            dashboards: dashboardId.toString() 
                        } 
                    }
                );

                logger.info('DashboardService: Dashboard ID added to project', { 
                    dashboardId: dashboardId.toString(), 
                    projectId: projectObjectId.toString()
                });
            } catch (error) {
                // Log error but don't fail the dashboard creation
                logger.error('DashboardService: Error adding dashboard to project', { 
                    error: error.message, 
                    dashboardId: dashboardId.toString(),
                    projectId,
                    stack: error.stack 
                });
            }
        }

        logger.info('DashboardService: Dashboard created', { 
            dashboardId: dashboardId.toString(), 
            projectId,
            reportsCount: reports.length 
        });

        return {
            _id: dashboardId.toString()
        };
    } catch (error) {
        logger.error('DashboardService: Error creating dashboard', { 
            error: error.message, 
            projectId,
            stack: error.stack 
        });
        throw error;
    }
}

module.exports = {
    createDashboard
};

