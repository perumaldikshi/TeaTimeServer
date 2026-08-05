const db = require('../config/db');
const cronService = require('../services/cronService');

// Get current time in minutes in the target local timezone
const getLocalTimeVal = () => {
  // Use APP_TIMEZONE to override, default to Asia/Kolkata (Vercel automatically sets TZ=UTC)
  let tz = process.env.APP_TIMEZONE || 'Asia/Kolkata';
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return hour * 60 + minute;
};

exports.triggerStart = async (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await cronService.handleStartTrigger();
    res.json({ message: 'Cron start trigger executed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.triggerEnd = async (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await cronService.handleEndTrigger();
    res.json({ message: 'Cron end trigger executed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.triggerTick = async (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    // 1. Fetch current settings from DB
    const settingsRes = await db.query('SELECT key, value FROM settings WHERE key IN (\'tea_time_start\', \'cutoff_time\', \'is_ordering_open\')');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const startTime = settings['tea_time_start'] || '16:30';
    const cutoffTime = settings['cutoff_time'] || '17:10';
    const isCurrentlyOpen = settings['is_ordering_open'] === 'true';

    // 2. Parse times
    const [startH, startM] = startTime.split(':').map(Number);
    const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);
    const startTimeVal = startH * 60 + startM;
    const cutoffTimeVal = cutoffH * 60 + cutoffM;

    // 3. Get current time in local timezone
    const currentTimeVal = getLocalTimeVal();

    const isWithinWindow = currentTimeVal >= startTimeVal && currentTimeVal <= cutoffTimeVal;

    let transition = null;
    if (isWithinWindow && !isCurrentlyOpen) {
      // Window should be open but is currently closed -> open it
      console.log(`[Cron Tick]: State transition -> opening window (Current time: ${currentTimeVal} is within [${startTimeVal}, ${cutoffTimeVal}])`);
      await cronService.handleStartTrigger();
      transition = 'opened';
    } else if (!isWithinWindow && isCurrentlyOpen) {
      // Window should be closed but is currently open -> close it
      console.log(`[Cron Tick]: State transition -> closing window (Current time: ${currentTimeVal} is outside [${startTimeVal}, ${cutoffTimeVal}])`);
      await cronService.handleEndTrigger();
      transition = 'closed';
    }

    res.json({
      success: true,
      currentTime: `${Math.floor(currentTimeVal / 60).toString().padStart(2, '0')}:${(currentTimeVal % 60).toString().padStart(2, '0')}`,
      currentTimeMinutes: currentTimeVal,
      window: `${startTime}-${cutoffTime}`,
      windowMinutes: `${startTimeVal}-${cutoffTimeVal}`,
      isWithinWindow,
      isCurrentlyOpen,
      transition
    });
  } catch (error) {
    next(error);
  }
};
