import type Anthropic from '@anthropic-ai/sdk';

// Anthropic tool definitions — what Claude sees
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_available_courts',
    description:
      'Returns real-time court availability from Google Calendar for a given sport and date. ' +
      'ALWAYS call this before suggesting any time slot or confirming availability. Never invent availability.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date to check availability in YYYY-MM-DD format. Today if not specified.',
        },
        sport: {
          type: 'string',
          enum: ['padel', 'tennis', 'soccer', 'basketball', 'volleyball'],
          description: 'Sport type to filter courts.',
        },
        time_start: {
          type: 'string',
          description: 'Preferred start time in HH:MM format (optional).',
        },
        time_end: {
          type: 'string',
          description: 'Preferred end time in HH:MM format (optional).',
        },
        duration_minutes: {
          type: 'number',
          description: 'Desired reservation duration in minutes (default: 60).',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'create_booking',
    description:
      'Creates a confirmed court reservation in the database AND in Google Calendar. ' +
      'Only call this AFTER the user has explicitly confirmed the booking details.',
    input_schema: {
      type: 'object',
      properties: {
        court_id: {
          type: 'string',
          description: 'UUID of the court to book.',
        },
        sport: {
          type: 'string',
          enum: ['padel', 'tennis', 'soccer', 'basketball', 'volleyball'],
        },
        starts_at: {
          type: 'string',
          description: 'Reservation start time in ISO 8601 format.',
        },
        ends_at: {
          type: 'string',
          description: 'Reservation end time in ISO 8601 format.',
        },
        player_name: {
          type: 'string',
          description: 'Name of the player making the booking.',
        },
        notes: {
          type: 'string',
          description: 'Optional notes for the reservation.',
        },
      },
      required: ['court_id', 'sport', 'starts_at', 'ends_at'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancels an existing reservation and removes the Google Calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        reservation_id: {
          type: 'string',
          description: 'UUID of the reservation to cancel.',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (optional).',
        },
      },
      required: ['reservation_id'],
    },
  },
  {
    name: 'reschedule_booking',
    description:
      'Moves an existing reservation to a new time slot. ' +
      'Always verify the new slot is available first with get_available_courts.',
    input_schema: {
      type: 'object',
      properties: {
        reservation_id: {
          type: 'string',
          description: 'UUID of the reservation to reschedule.',
        },
        new_starts_at: {
          type: 'string',
          description: 'New start time in ISO 8601 format.',
        },
        new_ends_at: {
          type: 'string',
          description: 'New end time in ISO 8601 format.',
        },
      },
      required: ['reservation_id', 'new_starts_at', 'new_ends_at'],
    },
  },
  {
    name: 'find_opponents',
    description:
      'Finds compatible players for a match using the matchmaking algorithm. ' +
      'Returns ranked candidates with compatibility percentages.',
    input_schema: {
      type: 'object',
      properties: {
        sport: {
          type: 'string',
          enum: ['padel', 'tennis', 'soccer', 'basketball', 'volleyball'],
        },
        preferred_date: {
          type: 'string',
          description: 'Preferred match date in YYYY-MM-DD format.',
        },
        time_start: {
          type: 'string',
          description: 'Preferred start time HH:MM.',
        },
        time_end: {
          type: 'string',
          description: 'Preferred end time HH:MM.',
        },
        skill_min: {
          type: 'number',
          description: 'Minimum skill score (0-1000). Optional.',
        },
        skill_max: {
          type: 'number',
          description: 'Maximum skill score (0-1000). Optional.',
        },
        gender_pref: {
          type: 'string',
          enum: ['male', 'female', 'non_binary', 'any'],
          description: 'Gender preference for opponent.',
        },
        age_min: {
          type: 'number',
          description: 'Minimum opponent age (optional).',
        },
        age_max: {
          type: 'number',
          description: 'Maximum opponent age (optional).',
        },
      },
      required: ['sport', 'preferred_date', 'time_start', 'time_end'],
    },
  },
  {
    name: 'get_player_profile',
    description: 'Returns a player\'s profile, stats, and skill information.',
    input_schema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'UUID of the player.',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'get_complex_information',
    description:
      'Returns sports complex information: available sports, courts, pricing, contact details, and schedule.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_reservation_details',
    description: 'Returns full details of a specific reservation by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        reservation_id: {
          type: 'string',
          description: 'UUID of the reservation.',
        },
      },
      required: ['reservation_id'],
    },
  },
];
