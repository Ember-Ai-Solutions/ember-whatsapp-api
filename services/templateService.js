const axios = require('axios');
const logger = require('../config/logger');
const environment = require('../config/environment');

const META_API_VERSION = environment.metaApiVersion;

function getBaseUrl(wabaId) {
    return `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`;
}

async function createTemplate({ wabaId, apiToken, name, category, language, components, parameter_format }) {
    try {
        const finalWabaId = wabaId;
        const response = await axios.post(
            getBaseUrl(finalWabaId),
            {
                name,
                category,
                language,
                components,
                parameter_format
            },
            {
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        logger.info('TemplateService: Meta template created', { wabaId: finalWabaId, name, category, language });
        return response.data;
    } catch (error) {
        logger.error('TemplateService: Error creating Meta template', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function listTemplates({ wabaId, apiToken, fields, limit, status, category, content, language, name, name_or_content, quality_score } = {}) {
    try {
        const finalWabaId = wabaId;
        const params = {};
        if (fields) params.fields = fields;
        if (limit) params.limit = limit;
        if (status) params.status = status;
        if (category) params.category = category;
        if (content) params.content = content;
        if (language) params.language = language;
        if (name) params.name = name;
        if (name_or_content) params.name_or_content = name_or_content;
        if (quality_score) params.quality_score = quality_score;
        const response = await axios.get(getBaseUrl(finalWabaId), {
            headers: {
                Authorization: `Bearer ${apiToken}`
            },
            params
        });
        logger.info('TemplateService: Meta templates listed', { wabaId: finalWabaId, ...params });
        return response.data;
    } catch (error) {
        logger.error('TemplateService: Error listing Meta templates', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function deleteTemplateByName({ wabaId, apiToken, name }) {
    try {
        const finalWabaId = wabaId;
        const response = await axios.delete(getBaseUrl(finalWabaId), {
            headers: {
                Authorization: `Bearer ${apiToken}`
            },
            params: { name }
        });
        logger.info('TemplateService: Meta template deleted by name', { wabaId: finalWabaId, name });
        return response.data;
    } catch (error) {
        logger.error('TemplateService: Error deleting Meta template by name', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function deleteTemplateByIdAndName({ wabaId, apiToken, hsm_id, name }) {
    try {
        const finalWabaId = wabaId;
        const response = await axios.delete(getBaseUrl(finalWabaId), {
            headers: {
                Authorization: `Bearer ${apiToken}`
            },
            params: { hsm_id, name }
        });
        logger.info('TemplateService: Meta template deleted by id and name', { wabaId: finalWabaId, hsm_id, name });
        return response.data;
    } catch (error) {
        logger.error('TemplateService: Error deleting Meta template by id and name', {
            error: error.response?.data || error.message,
            stack: error.stack
        });
        throw error;
    }
}



module.exports = {
    createTemplate,
    listTemplates,
    deleteTemplateByName,
    deleteTemplateByIdAndName
}; 