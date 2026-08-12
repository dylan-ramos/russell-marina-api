import { Catway } from '../models/catway.js';
import { Reservation } from '../models/reservation.js';
import { User } from '../models/user.js';
import { encodedCalendarDayBounds } from '../utils/calendar-date.js';

export async function dashboardData(now: Date) {
  const today = encodedCalendarDayBounds(now, 'Europe/Paris');
  const [currentReservations, catwayCount, reservationCount, userCount] = await Promise.all([
    Reservation.find({ startDate: { $lt: today.next }, endDate: { $gte: today.start } }).sort({
      endDate: 1,
      catwayNumber: 1,
    }),
    Catway.countDocuments(),
    Reservation.countDocuments(),
    User.countDocuments(),
  ]);

  return {
    currentReservations,
    statistics: { catwayCount, reservationCount, userCount },
  };
}
