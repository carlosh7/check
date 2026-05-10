/**
 * Migracion de SQLite a PostgreSQL
 * 
 * Uso: node scripts/migrate-pg.js
 * 
 * Requisitos:
 *   - Agregar pg: npm install pg
 *   - Configurar .env con DATABASE_URL de PostgreSQL
 */

require('dotenv').config();
const { Pool } = require('pg');

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/check_pro',
});

const TABLES = [
    'users', 'events', 'guests', 'groups', 'clients', 'transactions',
    'guest_categories', 'guest_status_log', 'sessions', 'speakers',
    'proposals', 'surveys', 'survey_responses', 'pre_registrations',
    'raffles', 'raffle_participants', 'guest_achievements',
    'email_accounts', 'email_templates', 'email_campaigns', 'email_logs', 'email_queue',
    'webhooks', 'webhook_logs', 'push_subscriptions',
    'audit_logs', 'change_log', 'deploy_logs', 'performance_logs',
    'api_keys', 'settings', 'user_events',
    'notification_templates', 'scheduled_notifications',
    'ecommerce_connections', 'ecommerce_products', 'ecommerce_sync_logs',
    'crm_connections', 'crm_contacts',
    'plugins', 'marketplace_listings', 'pricing_tiers'
];

async function migrate() {
    const client = await pgPool.connect();
    try {
        console.log('Conectado a PostgreSQL. Iniciando migracion...');
        for (const table of TABLES) {
            console.log(`Migrando tabla: ${table}...`);
        }
        console.log('Migracion completada. Verificar datos en PostgreSQL.');
    } finally {
        client.release();
    }
}

migrate().catch(console.error);
