export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Russell Marina API',
    version: '1.0.0',
    description:
      "API privée de la capitainerie Russell pour gérer les catways, les réservations et les utilisateurs. Connectez-vous depuis la page d'accueil avant d'utiliser les routes protégées.",
  },
  servers: [
    { url: '/', description: 'Serveur courant' },
    {
      url: 'https://russell-marina-api.srv924756.hstgr.cloud',
      description: 'Production',
    },
  ],
  tags: [
    { name: 'Authentification' },
    { name: 'Catways' },
    { name: 'Réservations' },
    { name: 'Utilisateurs' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'russell.sid',
        description: 'Cookie créé par POST /login.',
      },
      csrfToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description:
          'Jeton renvoyé dans cet en-tête par les routes protégées, requis pour POST, PUT et DELETE.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            properties: {
              status: { type: 'integer', example: 404 },
              message: { type: 'string', example: "La ressource n'existe pas." },
              messages: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      Catway: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66b89d9aa8317f1577744f20' },
          catwayNumber: { type: 'integer', minimum: 1, example: 24 },
          catwayType: { type: 'string', enum: ['long', 'short'], example: 'long' },
          catwayState: { type: 'string', example: 'Bon état général.' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CatwayCreate: {
        type: 'object',
        required: ['catwayNumber', 'catwayType', 'catwayState'],
        properties: {
          catwayNumber: { type: 'integer', minimum: 1, example: 25 },
          catwayType: { type: 'string', enum: ['long', 'short'], example: 'short' },
          catwayState: { type: 'string', minLength: 2, maxLength: 500, example: 'Neuf.' },
        },
      },
      CatwayUpdate: {
        type: 'object',
        required: ['catwayState'],
        properties: {
          catwayState: {
            type: 'string',
            minLength: 2,
            maxLength: 500,
            example: 'Une planche doit être remplacée.',
          },
        },
      },
      Reservation: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66b89d9aa8317f1577744f21' },
          catwayNumber: { type: 'integer', minimum: 1, example: 24 },
          clientName: { type: 'string', example: 'Jean Dupont' },
          boatName: { type: 'string', example: 'Le Grand Bleu' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ReservationInput: {
        type: 'object',
        required: ['clientName', 'boatName', 'startDate', 'endDate'],
        properties: {
          clientName: { type: 'string', minLength: 2, maxLength: 100, example: 'Jean Dupont' },
          boatName: { type: 'string', minLength: 2, maxLength: 100, example: 'Le Grand Bleu' },
          startDate: { type: 'string', format: 'date', example: '2030-06-01' },
          endDate: { type: 'string', format: 'date', example: '2030-06-10' },
        },
      },
      ReservationOverviewInput: {
        allOf: [
          { $ref: '#/components/schemas/ReservationInput' },
          {
            type: 'object',
            required: ['catwayNumber'],
            properties: {
              catwayNumber: { type: 'integer', minimum: 1, example: 24 },
            },
          },
        ],
      },
      User: {
        type: 'object',
        description: "Le hash du mot de passe n'est jamais renvoyé.",
        properties: {
          _id: { type: 'string', example: '66b89d9aa8317f1577744f22' },
          username: { type: 'string', example: 'capitainerie' },
          email: { type: 'string', format: 'email', example: 'demo@example.test' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserCreate: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 50, example: 'capitainerie' },
          email: { type: 'string', format: 'email', example: 'demo@example.test' },
          password: { type: 'string', format: 'password', minLength: 12, example: 'change-me-123' },
        },
      },
      UserUpdate: {
        type: 'object',
        required: ['username', 'email'],
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            format: 'password',
            minLength: 12,
            description: 'Facultatif : omettre ou laisser vide pour conserver le mot de passe.',
          },
        },
      },
    },
    parameters: {
      CatwayNumber: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
        description: 'Numéro unique du catway.',
      },
      ReservationId: {
        name: 'idReservation',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Identifiant MongoDB de la réservation.',
      },
      UserEmail: {
        name: 'email',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'email' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Requête incohérente.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unauthorized: { description: 'Session absente ou expirée.' },
      Forbidden: {
        description: 'Jeton CSRF absent ou invalide.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Ressource introuvable.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Conflict: {
        description: 'Doublon, chevauchement ou suppression interdite.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Données invalides.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  security: [{ sessionCookie: [] }],
  paths: {
    '/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Ouvrir une session',
        security: [{ csrfToken: [] }],
        description:
          "Le jeton CSRF est disponible dans l'en-tête de GET /. Réponse 302 vers /dashboard en cas de succès.",
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  _csrf: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          302: { description: 'Connexion réussie.' },
          401: { description: 'Identifiants incorrects.' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/logout': {
      get: {
        tags: ['Authentification'],
        summary: 'Fermer la session',
        responses: { 302: { description: "Session détruite, redirection vers l'accueil." } },
      },
      post: {
        tags: ['Authentification'],
        summary: 'Fermer la session depuis une interface protégée',
        security: [{ sessionCookie: [], csrfToken: [] }],
        responses: {
          302: { description: "Session détruite, redirection vers l'accueil." },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/catways': {
      get: {
        tags: ['Catways'],
        summary: 'Lister les catways',
        responses: {
          200: {
            description: 'Liste triée par numéro.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Catway' } },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Catways'],
        summary: 'Créer un catway',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CatwayCreate' } },
          },
        },
        responses: {
          201: {
            description: 'Catway créé.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Catway' } } },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/catways/{id}': {
      parameters: [{ $ref: '#/components/parameters/CatwayNumber' }],
      get: {
        tags: ['Catways'],
        summary: 'Afficher un catway',
        responses: {
          200: {
            description: 'Catway trouvé.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Catway' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Catways'],
        summary: "Modifier uniquement l'état",
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CatwayUpdate' } },
          },
        },
        responses: {
          200: { description: 'Catway modifié.' },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
      delete: {
        tags: ['Catways'],
        summary: 'Supprimer un catway sans réservation',
        security: [{ sessionCookie: [], csrfToken: [] }],
        responses: {
          204: { description: 'Catway supprimé.' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/catways/{id}/reservations': {
      parameters: [{ $ref: '#/components/parameters/CatwayNumber' }],
      get: {
        tags: ['Réservations'],
        summary: "Lister les réservations d'un catway",
        responses: {
          200: {
            description: 'Liste chronologique.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Reservation' } },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Réservations'],
        summary: 'Créer une réservation',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReservationInput' } },
          },
        },
        responses: {
          201: {
            description: 'Réservation créée.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reservation' } },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/catways/{id}/reservations/{idReservation}': {
      parameters: [
        { $ref: '#/components/parameters/CatwayNumber' },
        { $ref: '#/components/parameters/ReservationId' },
      ],
      get: {
        tags: ['Réservations'],
        summary: 'Afficher une réservation',
        responses: {
          200: {
            description: 'Réservation trouvée.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reservation' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Réservations'],
        summary: 'Modifier une réservation',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReservationInput' } },
          },
        },
        responses: {
          200: { description: 'Réservation modifiée.' },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
      delete: {
        tags: ['Réservations'],
        summary: 'Supprimer une réservation',
        security: [{ sessionCookie: [], csrfToken: [] }],
        responses: {
          204: { description: 'Réservation supprimée.' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/reservations': {
      get: {
        tags: ['Réservations'],
        summary: 'Lister toutes les réservations',
        description:
          "Renvoie du JSON avec Accept: application/json et la page d'administration avec Accept: text/html.",
        responses: {
          200: {
            description: 'Liste chronologique de toutes les réservations.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Reservation' } },
              },
              'text/html': { schema: { type: 'string' } },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Réservations'],
        summary: 'Créer une réservation en indiquant le catway',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReservationOverviewInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Réservation créée.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reservation' } },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Utilisateurs'],
        summary: 'Lister les utilisateurs',
        responses: {
          200: {
            description: 'Liste sans mot de passe.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Utilisateurs'],
        summary: 'Créer un utilisateur',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreate' } } },
        },
        responses: {
          201: {
            description: 'Utilisateur créé.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/users/{email}': {
      parameters: [{ $ref: '#/components/parameters/UserEmail' }],
      get: {
        tags: ['Utilisateurs'],
        summary: 'Afficher un utilisateur',
        responses: {
          200: {
            description: 'Utilisateur sans mot de passe.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Utilisateurs'],
        summary: 'Modifier un utilisateur',
        security: [{ sessionCookie: [], csrfToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserUpdate' } } },
        },
        responses: {
          200: { description: 'Utilisateur modifié.' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
      delete: {
        tags: ['Utilisateurs'],
        summary: 'Supprimer un utilisateur',
        description: 'Le compte courant et le dernier compte existant sont protégés.',
        security: [{ sessionCookie: [], csrfToken: [] }],
        responses: {
          204: { description: 'Utilisateur supprimé.' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
  },
} as const;
