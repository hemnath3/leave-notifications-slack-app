const moment = require('moment-timezone');

// Set timezone to AEST
const TIMEZONE = 'Australia/Sydney';

// NSW Public Holidays 2025 (you can expand this list)
const NSW_PUBLIC_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-27', // Australia Day
  '2025-04-18', // Good Friday
  '2025-04-21', // Easter Monday
  '2025-04-25', // ANZAC Day
  '2025-06-09', // King's Birthday
  '2025-10-06', // Labour Day
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
];

class DateUtils {
  // Get current date in AEST
  static getCurrentDate() {
    return moment().tz(TIMEZONE);
  }

  // Get today's date string in YYYY-MM-DD format
  static getTodayString() {
    return this.getCurrentDate().format('YYYY-MM-DD');
  }

  // Format date for display
  static formatDateForDisplay(date) {
    return moment(date).tz(TIMEZONE).format('DD/MM/YYYY');
  }

  // Format time for display
  static formatTimeForDisplay(date) {
    return moment(date).tz(TIMEZONE).format('HH:mm');
  }

  // Format date and time for display
  static formatDateTimeForDisplay(date) {
    return moment(date).tz(TIMEZONE).format('DD/MM/YYYY HH:mm');
  }

  // Check if date is a weekend (Saturday or Sunday)
  static isWeekend(date) {
    const day = moment(date).tz(TIMEZONE).day();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  // Check if date is a public holiday
  static isPublicHoliday(date) {
    const dateStr = moment(date).tz(TIMEZONE).format('YYYY-MM-DD');
    return NSW_PUBLIC_HOLIDAYS_2025.includes(dateStr);
  }

  // Check if date is a working day (not weekend and not public holiday)
  static isWorkingDay(date) {
    return !this.isWeekend(date) && !this.isPublicHoliday(date);
  }

  // Calculate working days between two dates
  static getWorkingDays(startDate, endDate) {
    let workingDays = 0;
    const start = moment(startDate).tz(TIMEZONE);
    const end = moment(endDate).tz(TIMEZONE);
    
    for (let day = start.clone(); day.isSameOrBefore(end); day.add(1, 'day')) {
      if (this.isWorkingDay(day)) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  // Get date 30 days ago
  static getThirtyDaysAgo() {
    return this.getCurrentDate().subtract(30, 'days');
  }

  // Get date 3 months from now
  static getThreeMonthsFromNow() {
    return this.getCurrentDate().add(3, 'months');
  }

  // Get next 3 working days
  static getNextThreeWorkingDays() {
    const days = [];
    let currentDate = this.getCurrentDate().add(1, 'day');
    let count = 0;
    
    while (count < 3 && days.length < 10) { // Limit to prevent infinite loop
      if (this.isWorkingDay(currentDate)) {
        days.push(currentDate.clone());
        count++;
      }
      currentDate.add(1, 'day');
    }
    
    return days;
  }

  // Check if date is within 30 days in the past
  static isWithinThirtyDaysPast(date) {
    const thirtyDaysAgo = this.getThirtyDaysAgo();
    return moment(date).tz(TIMEZONE).isSameOrAfter(thirtyDaysAgo);
  }

  // Check if date is within 3 months in the future
  static isWithinThreeMonthsFuture(date) {
    const threeMonthsFromNow = this.getThreeMonthsFromNow();
    return moment(date).tz(TIMEZONE).isSameOrBefore(threeMonthsFromNow);
  }

  // Get current time in AEST for display
  static getCurrentTimeString() {
    return this.getCurrentDate().format('HH:mm');
  }

  // Get current date and time for display
  static getCurrentDateTimeString() {
    return this.getCurrentDate().format('DD/MM/YYYY HH:mm');
  }
}

module.exports = DateUtils; 