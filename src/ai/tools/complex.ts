import { getCourtsByComplex } from '../../db/queries/courts.js';
import type { SportsComplex } from '../../types/index.js';

export async function getComplexInformation(complex: SportsComplex) {
  const courts = await getCourtsByComplex(complex.id);

  const courtsBySport = courts.reduce<Record<string, typeof courts>>(
    (acc, court) => {
      if (!acc[court.sport]) acc[court.sport] = [];
      acc[court.sport].push(court);
      return acc;
    },
    {}
  );

  const sportsAvailable = Object.keys(courtsBySport);

  return {
    name: complex.name,
    address: complex.address,
    city: complex.city,
    timezone: complex.timezone,
    sports_available: sportsAvailable,
    courts: courts.map(c => ({
      id: c.id,
      name: c.name,
      sport: c.sport,
      indoor: c.indoor,
      surface: c.surface,
      hourly_rate: c.hourly_rate ? `${c.hourly_rate} ${c.currency}` : 'Consultar',
      amenities: c.amenities,
    })),
    total_courts: courts.length,
    contact: {
      phone: complex.phone,
      email: complex.email,
    },
  };
}
