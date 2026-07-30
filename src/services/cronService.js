const cron = require('node-cron');
const db = require('../config/db');
const notificationService = require('./notificationService');

let activeJobs = [];

// Trigger handler: Open ordering window and broadcast starting notification
const handleStartTrigger = async () => {
  console.log('[Cron/Trigger]: Executing start trigger...');
  try {
    // Open ordering window in settings
    await db.query('INSERT INTO settings (key, value) VALUES (\'is_ordering_open\', \'true\') ON CONFLICT (key) DO UPDATE SET value = \'true\'');
    
    // Broadcast notifications to all employees
    await notificationService.sendPushNotification(
      '🍵 Tea Time Started',
      'Tap to Order'
    );
    console.log('[Cron/Trigger]: Start trigger executed successfully.');
  } catch (err) {
    console.error('Error in handleStartTrigger:', err);
    throw err;
  }
};

// Trigger handler: Close ordering window and broadcast cutoff notification
const handleEndTrigger = async () => {
  console.log('[Cron/Trigger]: Executing end trigger...');
  try {
    // Close ordering window in settings
    await db.query('INSERT INTO settings (key, value) VALUES (\'is_ordering_open\', \'false\') ON CONFLICT (key) DO UPDATE SET value = \'false\'');
    
    // Broadcast notifications to all employees
    await notificationService.sendPushNotification(
      'Ordering Closed',
      'The ordering cutoff window has passed.'
    );
    console.log('[Cron/Trigger]: End trigger executed successfully.');
  } catch (err) {
    console.error('Error in handleEndTrigger:', err);
    throw err;
  }
};

// Query settings and schedule background jobs in the target timezone
const rescheduleJobs = async () => {
  console.log('Rescheduling automated tea timer jobs...');
  try {
    // 1. Fetch current settings from DB
    const settingsRes = await db.query('SELECT key, value FROM settings WHERE key IN (\'tea_time_start\', \'cutoff_time\')');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const startTime = settings['tea_time_start'] || '16:55';
    const cutoffTime = settings['cutoff_time'] || '17:10';

    // 2. Parse times (HH:MM)
    const [startH, startM] = startTime.split(':').map(Number);
    const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);

    // 3. Stop existing cron jobs
    activeJobs.forEach(job => job.stop());
    activeJobs = [];

    const tz = process.env.TZ || 'Asia/Kolkata';

    // 4. Schedule Start Job
    const startCronExpr = `${startM} ${startH} * * *`;
    const startJob = cron.schedule(startCronExpr, async () => {
      console.log(`[Cron Job]: Running start trigger at ${startTime}...`);
      try {
        await handleStartTrigger();
      } catch (err) {
        console.error('Error executing start cron job:', err);
      }
    }, {
      scheduled: true,
      timezone: tz
    });
    activeJobs.push(startJob);

    // 5. Schedule End Job
    const cutoffCronExpr = `${cutoffM} ${cutoffH} * * *`;
    const cutoffJob = cron.schedule(cutoffCronExpr, async () => {
      console.log(`[Cron Job]: Running end trigger at ${cutoffTime}...`);
      try {
        await handleEndTrigger();
      } catch (err) {
        console.error('Error executing end cron job:', err);
      }
    }, {
      scheduled: true,
      timezone: tz
    });
    activeJobs.push(cutoffJob);

    console.log(`Automated tea timers rescheduled successfully (${startTime} & ${cutoffTime} in ${tz} timezone).`);
  } catch (error) {
    console.error('Failed to reschedule cron jobs:', error);
  }
};

const initCronJobs = () => {
  rescheduleJobs();
};

module.exports = {
  initCronJobs,
  rescheduleJobs,
  handleStartTrigger,
  handleEndTrigger
};
