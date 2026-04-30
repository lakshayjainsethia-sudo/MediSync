# Medisync Backend Architecture Layout

The backend follows a professional, scalable Controller-Service-Repository pattern. Here is the layout:

```text
server/
├── config/                 # Environment variables and configuration files (e.g., db.js)
├── controllers/            # Controller layer: Handles incoming HTTP requests and responses
│   ├── AppointmentController.js
│   └── AuthController.js
├── middleware/             # Custom express middleware
│   ├── authMiddleware.js   # JWT authentication and RBAC checks
│   ├── errorMiddleware.js  # Global error handling middleware
│   ├── validate.js         # express-validator middleware wrappers
│   └── securityConfig.js   # Helmet, CORS, and rate-limiting setup
├── models/                 # Mongoose schemas and models (Repository layer)
│   ├── User.js
│   ├── Appointment.js
│   └── Billing.js
├── routes/                 # Express route definitions pointing to controllers
│   ├── appointmentRoutes.js
│   └── authRoutes.js
├── services/               # Service layer: Contains all core business logic
│   ├── AppointmentService.js
│   └── BillingService.js
├── utils/                  # Reusable utility functions and classes
│   ├── ApiError.js         # Custom Error class for formatted API errors
│   └── asyncHandler.js     # Wrapper to eliminate try-catch blocks in controllers
├── app.js                  # Express app setup, middleware, and route mounting
└── server.js               # Entry point: Connects to DB and starts the server
```

## Key Architectural Decisions:
1. **Controller-Service-Repository Pattern**: Separates concerns. Controllers only handle HTTP parsing/formatting. Services perform the actual business logic (conflict detection, logic encapsulation, calculations). Models handle direct DB access and data validation.
2. **Global Error Handling**: Leveraging `asyncHandler` and `ApiError` provides a standardized JSON error format `{ success: false, message: string }`, eliminating repetitive `try-catch` blocks and keeping controllers clean.
3. **Mongoose Transactions**: Used for critical operations (like checkout, which simultaneously updates billing and appointment) to ensure atomicity.
4. **Security**: Hardened via `helmet`, explicit `cors` origins, input validation with `express-validator`, and role-based access control inside custom middlewares.
