const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

const BLIP_COMMANDS_URL = 'https://msging.net/commands';
const BLIP_API_STATES_URL = 'https://flowassistant.cs.blip.ai/api-states';

/**
 * Delete API state from Flow Assistant
 * @param {Object} params - Delete parameters
 * @param {string} params.contactIdentity - Contact identity (e.g., "5531996371744.whatsapp@0mn.io")
 * @param {string} params.botAuthorization - Bot authorization token (format: "Key {token}" or just the token)
 * @returns {Promise<Object>} Response from API
 */
async function deleteApiState({ contactIdentity, botAuthorization }) {
    try {
        // Ensure authorization header format is correct
        const botAuthHeader = botAuthorization.startsWith('Key ') ? botAuthorization : `Key ${botAuthorization}`;

        const headers = {
            'ContactIdentity': contactIdentity,
            'BotAuthorization': botAuthHeader
        };

        logger.info('BlipCommandService: Deleting API state', {
            contactIdentity
        });

        const response = await axios.delete(BLIP_API_STATES_URL, {
            headers: headers
        });

        logger.info('BlipCommandService: API state deleted successfully', {
            contactIdentity,
            status: response.status
        });

        return response.data;

    } catch (error) {
        logger.error('BlipCommandService: Error deleting API state', {
            contactIdentity,
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Merge contact in Blip API and delete API state
 * @param {Object} params - Merge contact parameters
 * @param {Object} params.resource - The resource object with contact data (JSON)
 * @param {string} params.authorization - Authorization token (format: "Key {token}" or just the token)
 * @param {string} [params.botAuthorization] - Bot authorization token for API state deletion (defaults to authorization if not provided)
 * @returns {Promise<Object>} Response from Blip API command
 */
async function mergeContact({ resource, authorization, botAuthorization }) {
    try {
        // Generate UUID for command ID
        const commandId = crypto.randomUUID();

        // Ensure authorization header format is correct
        const authHeader = authorization.startsWith('Key ') ? authorization : `Key ${authorization}`;

        const commandData = {
            id: commandId,
            to: 'postmaster@crm.msging.net',
            method: 'merge',
            uri: '/contacts',
            type: 'application/vnd.lime.contact+json',
            resource: resource
        };

        logger.info('BlipCommandService: Merging contact in Blip', {
            commandId,
            resource: resource.identity || resource.name || 'unknown'
        });

        const response = await axios.post(BLIP_COMMANDS_URL, commandData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        logger.info('BlipCommandService: Contact merged successfully', {
            commandId,
            status: response.status
        });

        // Delete API state if contactIdentity is available in resource
        if (resource.identity) {
            try {
                const botAuth = botAuthorization || authorization;
                await deleteApiState({
                    contactIdentity: resource.identity,
                    botAuthorization: botAuth
                });
            } catch (deleteError) {
                // Log error but don't fail the command if state deletion fails
                logger.warn('BlipCommandService: Failed to delete API state, but command was successful', {
                    contactIdentity: resource.identity,
                    error: deleteError.message
                });
            }
        }

        return response.data;

    } catch (error) {
        logger.error('BlipCommandService: Error merging contact in Blip', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    mergeContact,
    deleteApiState
};
