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

    // Validate name (required)
    if (!report.name || typeof report.name !== 'string' || report.name.trim() === '') {
        errors.push('Report name is required');
    }

    // Validate type (required)
    const validTypes = ['number', 'pie', 'bar'];
    if (!report.type || !validTypes.includes(report.type)) {
        errors.push(`Report type is required and must be one of: ${validTypes.join(', ')}`);
    }

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
            name: report.name.trim(),
            type: report.type,
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
                // Save as ObjectId, not string
                await projectsCollection.updateOne(
                    { _id: projectObjectId },
                    { 
                        $addToSet: { 
                            dashboards: dashboardId 
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

/**
 * Get dashboard by ID and verify project access
 */
async function getDashboardById(dashboardId, projectId) {
    try {
        if (!dashboardId) {
            throw new Error('Dashboard ID is required');
        }

        if (!projectId) {
            throw new Error('Project ID is required');
        }

        // Convert dashboardId to ObjectId if it's a string
        const dashboardObjectId = typeof dashboardId === 'string' 
            ? new mongodbService.ObjectId(dashboardId) 
            : dashboardId;

        // Convert projectId to ObjectId if it's a string
        const projectObjectId = typeof projectId === 'string' 
            ? new mongodbService.ObjectId(projectId) 
            : projectId;

        // First, verify that the project has access to this dashboard
        const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
        const projectsCollection = clientsDb.collection(PROJECTS_COLLECTION_NAME);
        
        const project = await projectsCollection.findOne({ _id: projectObjectId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        // Check if dashboard ID is in project's dashboards array
        const dashboards = project.dashboards || [];
        const hasAccess = dashboards.some(dashId => {
            // Compare ObjectIds directly
            const dashIdObj = dashId instanceof mongodbService.ObjectId ? dashId : new mongodbService.ObjectId(dashId);
            return dashIdObj.equals(dashboardObjectId);
        });

        if (!hasAccess) {
            throw new Error('Access denied: Project does not have access to this dashboard');
        }

        // If project has access, fetch the dashboard
        const websiteDb = await mongodbService.getDbConnection(WEBSITE_DB_NAME);
        const dashboardsCollection = websiteDb.collection(DASHBOARDS_COLLECTION_NAME);
        
        const dashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        logger.info('DashboardService: Dashboard retrieved', { 
            dashboardId: dashboardObjectId.toString(), 
            projectId: projectObjectId.toString()
        });

        return dashboard;
    } catch (error) {
        logger.error('DashboardService: Error getting dashboard', { 
            error: error.message, 
            dashboardId,
            projectId,
            stack: error.stack 
        });
        throw error;
    }
}

/**
 * Update dashboard reports
 */
async function updateDashboard(dashboardId, projectId, dashboardData) {
    try {
        if (!dashboardId) {
            throw new Error('Dashboard ID is required');
        }

        if (!projectId) {
            throw new Error('Project ID is required');
        }

        // Convert dashboardId to ObjectId if it's a string
        const dashboardObjectId = typeof dashboardId === 'string' 
            ? new mongodbService.ObjectId(dashboardId) 
            : dashboardId;

        // Convert projectId to ObjectId if it's a string
        const projectObjectId = typeof projectId === 'string' 
            ? new mongodbService.ObjectId(projectId) 
            : projectId;

        // First, verify that the project has access to this dashboard
        const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
        const projectsCollection = clientsDb.collection(PROJECTS_COLLECTION_NAME);
        
        const project = await projectsCollection.findOne({ _id: projectObjectId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        // Check if dashboard ID is in project's dashboards array
        const dashboards = project.dashboards || [];
        const hasAccess = dashboards.some(dashId => {
            // Compare ObjectIds directly
            const dashIdObj = dashId instanceof mongodbService.ObjectId ? dashId : new mongodbService.ObjectId(dashId);
            return dashIdObj.equals(dashboardObjectId);
        });

        if (!hasAccess) {
            throw new Error('Access denied: Project does not have access to this dashboard');
        }

        // Verify dashboard exists
        const websiteDb = await mongodbService.getDbConnection(WEBSITE_DB_NAME);
        const dashboardsCollection = websiteDb.collection(DASHBOARDS_COLLECTION_NAME);
        
        const existingDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        if (!existingDashboard) {
            throw new Error('Dashboard not found');
        }

        // Normalize reports if provided
        let reports = existingDashboard.reports || [];
        if (dashboardData.reports !== undefined) {
            if (!Array.isArray(dashboardData.reports)) {
                throw new Error('Reports must be an array');
            }
            reports = normalizeReports(dashboardData.reports);
        }

        // Update dashboard
        await dashboardsCollection.updateOne(
            { _id: dashboardObjectId },
            { 
                $set: { 
                    reports: reports 
                } 
            }
        );

        logger.info('DashboardService: Dashboard updated', { 
            dashboardId: dashboardObjectId.toString(), 
            projectId: projectObjectId.toString(),
            reportsCount: reports.length 
        });

        // Fetch updated dashboard
        const updatedDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        return updatedDashboard;
    } catch (error) {
        logger.error('DashboardService: Error updating dashboard', { 
            error: error.message, 
            dashboardId,
            projectId,
            stack: error.stack 
        });
        throw error;
    }
}

/**
 * Add a report to dashboard
 */
async function addReportToDashboard(dashboardId, projectId, reportData) {
    try {
        if (!dashboardId) {
            throw new Error('Dashboard ID is required');
        }

        if (!projectId) {
            throw new Error('Project ID is required');
        }

        // Convert dashboardId to ObjectId if it's a string
        const dashboardObjectId = typeof dashboardId === 'string' 
            ? new mongodbService.ObjectId(dashboardId) 
            : dashboardId;

        // Convert projectId to ObjectId if it's a string
        const projectObjectId = typeof projectId === 'string' 
            ? new mongodbService.ObjectId(projectId) 
            : projectId;

        // Verify project access
        const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
        const projectsCollection = clientsDb.collection(PROJECTS_COLLECTION_NAME);
        
        const project = await projectsCollection.findOne({ _id: projectObjectId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        const dashboards = project.dashboards || [];
        const hasAccess = dashboards.some(dashId => {
            const dashIdObj = dashId instanceof mongodbService.ObjectId ? dashId : new mongodbService.ObjectId(dashId);
            return dashIdObj.equals(dashboardObjectId);
        });

        if (!hasAccess) {
            throw new Error('Access denied: Project does not have access to this dashboard');
        }

        // Get existing dashboard
        const websiteDb = await mongodbService.getDbConnection(WEBSITE_DB_NAME);
        const dashboardsCollection = websiteDb.collection(DASHBOARDS_COLLECTION_NAME);
        
        const existingDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        if (!existingDashboard) {
            throw new Error('Dashboard not found');
        }

        // Get existing reports
        const existingReports = existingDashboard.reports || [];
        const existingPositions = existingReports.map(r => r.position).filter(p => p !== undefined);

        // Validate name (required)
        if (!reportData.name || typeof reportData.name !== 'string' || reportData.name.trim() === '') {
            throw new Error('Report name is required');
        }

        // Validate type (required)
        const validTypes = ['number', 'pie', 'bar'];
        if (!reportData.type || !validTypes.includes(reportData.type)) {
            throw new Error(`Report type is required and must be one of: ${validTypes.join(', ')}`);
        }

        // Validate the new report structure first (without position validation)
        if (!reportData.metrics || !Array.isArray(reportData.metrics) || reportData.metrics.length === 0) {
            throw new Error('Report must have at least one metric with a type');
        }

        // Validate each metric has a type and is valid
        const validMetricTypes = ['messagesSent', 'campaignsTotal', 'replies', 'views', 'errors'];
        reportData.metrics.forEach((metric, index) => {
            if (!metric.type) {
                throw new Error(`Metric at index ${index} must have a type`);
            }
            if (!validMetricTypes.includes(metric.type)) {
                throw new Error(`Invalid metric type: ${metric.type} at index ${index}`);
            }
        });

        // Generate _id if not provided
        const reportId = reportData._id || new mongodbService.ObjectId();
        
        // Generate position if not provided (next available position)
        let position = reportData.position;
        if (position === undefined) {
            position = getNextPosition(existingPositions);
        }

        // Create new report
        const newReport = {
            _id: typeof reportId === 'string' ? new mongodbService.ObjectId(reportId) : reportId,
            position: position,
            name: reportData.name.trim(),
            type: reportData.type,
            metrics: reportData.metrics || [],
            filters: reportData.filters || {}
        };

        // Add new report to existing reports
        const allReports = [...existingReports, newReport];
        
        // Re-normalize positions to ensure they're sequential (1, 2, 3...)
        allReports.forEach((report, index) => {
            report.position = index + 1;
        });

        // Update dashboard
        await dashboardsCollection.updateOne(
            { _id: dashboardObjectId },
            { 
                $set: { 
                    reports: allReports 
                } 
            }
        );

        logger.info('DashboardService: Report added to dashboard', { 
            dashboardId: dashboardObjectId.toString(), 
            projectId: projectObjectId.toString(),
            reportId: newReport._id.toString(),
            position: newReport.position
        });

        // Fetch updated dashboard
        const updatedDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        return updatedDashboard;
    } catch (error) {
        logger.error('DashboardService: Error adding report to dashboard', { 
            error: error.message, 
            dashboardId,
            projectId,
            stack: error.stack 
        });
        throw error;
    }
}

/**
 * Remove a report from dashboard
 */
async function removeReportFromDashboard(dashboardId, projectId, reportId) {
    try {
        if (!dashboardId) {
            throw new Error('Dashboard ID is required');
        }

        if (!projectId) {
            throw new Error('Project ID is required');
        }

        if (!reportId) {
            throw new Error('Report ID is required');
        }

        // Convert IDs to ObjectId if they're strings
        const dashboardObjectId = typeof dashboardId === 'string' 
            ? new mongodbService.ObjectId(dashboardId) 
            : dashboardId;

        const projectObjectId = typeof projectId === 'string' 
            ? new mongodbService.ObjectId(projectId) 
            : projectId;

        const reportObjectId = typeof reportId === 'string' 
            ? new mongodbService.ObjectId(reportId) 
            : reportId;

        // Verify project access
        const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
        const projectsCollection = clientsDb.collection(PROJECTS_COLLECTION_NAME);
        
        const project = await projectsCollection.findOne({ _id: projectObjectId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        const dashboards = project.dashboards || [];
        const hasAccess = dashboards.some(dashId => {
            const dashIdObj = dashId instanceof mongodbService.ObjectId ? dashId : new mongodbService.ObjectId(dashId);
            return dashIdObj.equals(dashboardObjectId);
        });

        if (!hasAccess) {
            throw new Error('Access denied: Project does not have access to this dashboard');
        }

        // Get existing dashboard
        const websiteDb = await mongodbService.getDbConnection(WEBSITE_DB_NAME);
        const dashboardsCollection = websiteDb.collection(DASHBOARDS_COLLECTION_NAME);
        
        const existingDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        if (!existingDashboard) {
            throw new Error('Dashboard not found');
        }

        // Get existing reports
        const existingReports = existingDashboard.reports || [];
        
        // Find and remove the report
        const reportIndex = existingReports.findIndex(r => {
            const rId = r._id instanceof mongodbService.ObjectId ? r._id : new mongodbService.ObjectId(r._id);
            return rId.equals(reportObjectId);
        });

        if (reportIndex === -1) {
            throw new Error('Report not found');
        }

        // Remove the report
        const updatedReports = existingReports.filter((r, index) => index !== reportIndex);

        // Re-normalize positions to ensure they're sequential (1, 2, 3...)
        if (updatedReports.length > 0) {
            // Reset positions and re-assign sequentially
            updatedReports.forEach((report, index) => {
                report.position = index + 1;
            });
        }

        // Update dashboard
        await dashboardsCollection.updateOne(
            { _id: dashboardObjectId },
            { 
                $set: { 
                    reports: updatedReports 
                } 
            }
        );

        logger.info('DashboardService: Report removed from dashboard', { 
            dashboardId: dashboardObjectId.toString(), 
            projectId: projectObjectId.toString(),
            reportId: reportObjectId.toString()
        });

        // Fetch updated dashboard
        const updatedDashboard = await dashboardsCollection.findOne({ _id: dashboardObjectId });

        return updatedDashboard;
    } catch (error) {
        logger.error('DashboardService: Error removing report from dashboard', { 
            error: error.message, 
            dashboardId,
            projectId,
            reportId,
            stack: error.stack 
        });
        throw error;
    }
}

module.exports = {
    createDashboard,
    getDashboardById,
    updateDashboard,
    addReportToDashboard,
    removeReportFromDashboard
};

