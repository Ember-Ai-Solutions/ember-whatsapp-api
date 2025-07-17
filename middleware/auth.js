const axios = require('axios');
const crypto = require('crypto');
const environment = require('../config/environment');
const mongodbService = require('../services/mongodbService');
const logger = require('../config/logger');

const JWT_VALIDATION_URL = environment.emberAuthUrl + '/token/verify';
const CLIENTS_DB_NAME = environment.mongoClientsDbName;
const PROJECTS_COLLECTION_NAME = environment.mongoProjectsCollectionName;

function jwtTokenValidation(role) {
    return async function (req, res, next) {
        try {
            const authHeader = req.headers['authorization'] || req.cookies.token;
            const roleLevels = ['viewer', 'editor', 'admin', 'owner'];
            let tokenRoleLevel = -1;

            const token = authHeader.replace('Bearer ', '');
            const response = await axios.post(JWT_VALIDATION_URL, { token });

            if (!response.status === 200) {
                logger.error('AuthMiddleware: JWT validation failed', { status: response.status });
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
            const projects = await clientsDb.collection(PROJECTS_COLLECTION_NAME).find().toArray();

            if (response.data.type === 'user') {
                if (req.query.projectId) {
                    const project = projects.find(project => project._id == req.query.projectId);
                    if (!project) {
                        logger.error('AuthMiddleware: Project not found', { projectId: req.query.projectId });
                        return res.status(401).json({ message: 'Project not found' });
                    } else if (project.members[response.data.userId]) {
                        tokenRoleLevel = project.members[response.data.userId].role;
                        req.body.projectId = project._id;
                        req.body.fromPhoneNumber = project.integrations.whatsApp.phoneNumber;
                        req.body.wabaId = project.integrations.whatsApp.businessAccountId;
                        req.body.phoneId = project.integrations.whatsApp.phoneId;
                        req.body.apiToken = project.integrations.whatsApp.apiToken;
                    } else {
                        logger.error('AuthMiddleware: User does not have permission for this project', { userId: response.data.userId, projectId: req.query.projectId });
                        return res.status(401).json({ message: 'You do not have permission to access this project' });
                    }
                } else {
                    logger.error('AuthMiddleware: Project ID not provided');
                    return res.status(401).json({ message: 'Project ID not provided' });
                }
            } else if (response.data.type === 'service') {
                const project = projects.find(project => project._id == response.data.projectId);
                if (!project) {
                    logger.error('AuthMiddleware: Project not found for service', { projectId: response.data.projectId });
                    return res.status(401).json({ message: 'Project not found' });
                } else {
                    req.body.projectId = project._id;
                    req.body.fromPhoneNumber = project.integrations.whatsApp.phoneNumber;
                    req.body.wabaId = project.integrations.whatsApp.businessAccountId;
                    req.body.phoneId = project.integrations.whatsApp.phoneId;
                    req.body.apiToken = project.integrations.whatsApp.apiToken;
                    tokenRoleLevel = roleLevels.indexOf(response.data.role);
                }
            }

            const currentRoleLevel = roleLevels.indexOf(role);
            if (tokenRoleLevel < currentRoleLevel) {
                logger.error('AuthMiddleware: User does not have required role', { requiredRole: role, userRoleLevel: tokenRoleLevel });
                return res.status(401).json({ message: 'Unauthorized' });
            }

            logger.info('AuthMiddleware: Authentication and authorization successful', { userType: response.data.type });
            return next();

        } catch (error) {
            logger.error('AuthMiddleware: Error during authentication', { error: error.response?.data || error.message });
            return res.status(401).json({ message: 'Unauthorized', details: error.response?.data || error.message });
        }
    };
}

async function originRequestValidation(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];
    const projectId = req.params.projectId;

    const clientsDb = await mongodbService.getDbConnection(CLIENTS_DB_NAME);
    const project = await clientsDb.collection(PROJECTS_COLLECTION_NAME).findOne({ _id: projectId });
    if (!project) {
        logger.error('AuthMiddleware: Project not found in originRequestValidation', { projectId });
        return res.status(401).json({ message: 'Project not found' });
    }

    const appSecret = project.integrations.whatsApp.appSecret;

    if (signature && appSecret) {
        const expectedSignature =
            'sha256=' +
            crypto
                .createHmac('sha256', appSecret)
                .update(req.rawBody)
                .digest('hex');

        if (signature === expectedSignature) {
            logger.info('AuthMiddleware: Signature validated successfully', { projectId });
            return next();
        }
        logger.error('AuthMiddleware: Invalid signature', { projectId });
        return res.status(403).json({ message: 'Invalid signature' });
    }

    logger.error('AuthMiddleware: Unauthorized access attempt', { projectId });
    return res.status(403).json({ message: 'Access not authorized' });
}

module.exports = { jwtTokenValidation, originRequestValidation }; 