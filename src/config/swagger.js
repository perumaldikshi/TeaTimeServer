const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Tea Time Management System API",
    version: "1.0.0",
    description: "Interactive API specification for checking backend route behaviors."
  },
  servers: [
    {
      url: "http://localhost:5000/api",
      description: "Development Local Server"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    "/login": {
      post: {
        summary: "Login user & fetch JWT",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", example: "admin@teatime.com" },
                  password: { type: "string", example: "admin123" }
                },
                required: ["email", "password"]
              }
            }
          }
        },
        responses: {
          200: { description: "Logged in successfully" },
          401: { description: "Invalid credentials" }
        }
      }
    },
    "/dashboard": {
      get: {
        summary: "Retrieve dashboard statistics",
        tags: ["Dashboard"],
        responses: {
          200: { description: "Dashboard loaded" }
        }
      }
    },
    "/order": {
      post: {
        summary: "Submit tea/coffee order",
        tags: ["Orders"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  teaItemId: { type: "integer", example: 1 },
                  quantity: { type: "integer", example: 1 }
                },
                required: ["teaItemId", "quantity"]
              }
            }
          }
        },
        responses: {
          201: { description: "Order placed successfully" }
        }
      },
      put: {
        summary: "Cancel or modify today's order",
        tags: ["Orders"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "cancelled" },
                  teaItemId: { type: "integer" },
                  quantity: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Order updated successfully" }
        }
      }
    },
    "/today-orders": {
      get: {
        summary: "List today's orders",
        tags: ["Orders"],
        responses: {
          200: { description: "Orders returned" }
        }
      }
    },
    "/employees": {
      get: {
        summary: "List employees (Admin only)",
        tags: ["Admin"],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } }
        ],
        responses: {
          200: { description: "List of employees" }
        }
      }
    },
    "/monthly-report": {
      get: {
        summary: "Get current monthly summary (Admin only)",
        tags: ["Reports"],
        responses: {
          200: { description: "Monthly stats" }
        }
      }
    },
    "/download-pdf": {
      get: {
        summary: "Download PDF report (Admin only)",
        tags: ["Reports"],
        parameters: [
          { name: "reportType", in: "query", schema: { type: "string", example: "monthly" } }
        ],
        responses: {
          200: { description: "Returns PDF binary stream" }
        }
      }
    },
    "/download-excel": {
      get: {
        summary: "Download Excel sheet (Admin only)",
        tags: ["Reports"],
        parameters: [
          { name: "reportType", in: "query", schema: { type: "string", example: "monthly" } }
        ],
        responses: {
          200: { description: "Returns Excel binary stream" }
        }
      }
    },
    "/send-notification": {
      post: {
        summary: "Manual push notification broadcast (Admin only)",
        tags: ["Notifications"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "🍵 Tea Time Started" },
                  body: { type: "string", example: "Tap to Order" }
                },
                required: ["title", "body"]
              }
            }
          }
        },
        responses: {
          200: { description: "Notification trigger completed" }
        }
      }
    }
  }
};

module.exports = {
  swaggerUi,
  swaggerDocument
};
