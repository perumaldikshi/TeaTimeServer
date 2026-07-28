const cron = require('node-cron');
const db = require('../config/db');
const notificationService = require('./notificationService');

const initCronJobs = () => {
  // Cron 1: 4:55 PM (16:55) - Set order open to true and broadcast "Tea Time Started"
  cron.schedule('55 16 * * *', async () => {
    console.log('[Cron Job]: Running 16:55 (4:55 PM) trigger...');
    try {
      // Open ordering window in settings
      await db.query('INSERT INTO settings (key, value) VALUES (\'is_ordering_open\', \'true\') ON CONFLICT (key) DO UPDATE SET value = \'true\'');
      
      // Broadcast notifications to all employees
      await notificationService.sendPushNotification(
        '🍵 Tea Time Started',
        'Tap to Order'
      );
      console.log('[Cron Job]: 16:55 task executed successfully.');
    } catch (err) {
      console.error('Error executing 16:55 cron task:', err);
    }
  });

  // Cron 2: 5:10 PM (17:10) - Set order open to false and broadcast "Ordering Closed"
  cron.schedule('10 17 * * *', async () => {
    console.log('[Cron Job]: Running 17:10 (5:10 PM) trigger...');
    try {
      // Close ordering window in settings
      await db.query('INSERT INTO settings (key, value) VALUES (\'is_ordering_open\', \'false\') ON CONFLICT (key) DO UPDATE SET value = \'false\'');
      
      // Broadcast notifications to all employees
      await notificationService.sendPushNotification(
        'Ordering Closed',
        'The ordering cutoff window has passed.'
      );
      console.log('[Cron Job]: 17:10 task executed successfully.');
    } catch (err) {
      console.error('Error executing 17:10 cron task:', err);
    }
  });

  console.log('Automated tea timers initialized (4:55 PM & 5:10 PM daily schedulers).');
};

module.exports = { initCronJobs };
