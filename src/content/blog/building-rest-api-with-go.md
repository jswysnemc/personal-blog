---
title: "Building a REST API with Go and Gin"
description: "Step-by-step tutorial on creating a production-ready REST API using Go, Gin framework, and PostgreSQL"
pubDate: 2026-01-19
category: tutorial
tags: ["Go", "Gin", "REST API", "Backend", "PostgreSQL"]
draft: false
---

Go is an excellent choice for building high-performance APIs. In this tutorial, we'll create a complete REST API using the Gin framework.

## Project Setup

```bash
mkdir go-api && cd go-api
go mod init github.com/yourusername/go-api
```

### Install Dependencies

```bash
go get -u github.com/gin-gonic/gin
go get -u gorm.io/gorm
go get -u gorm.io/driver/postgres
go get -u github.com/joho/godotenv
```

## Project Structure

```
go-api/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── handlers/
│   │   └── user.go
│   ├── models/
│   │   └── user.go
│   ├── repository/
│   │   └── user.go
│   └── routes/
│       └── routes.go
├── pkg/
│   └── database/
│       └── postgres.go
├── .env
├── go.mod
└── go.sum
```

## Database Configuration

### pkg/database/postgres.go

```go
package database

import (
    "fmt"
    "log"
    "os"

    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
    dsn := fmt.Sprintf(
        "host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
        os.Getenv("DB_HOST"),
        os.Getenv("DB_USER"),
        os.Getenv("DB_PASSWORD"),
        os.Getenv("DB_NAME"),
        os.Getenv("DB_PORT"),
    )

    var err error
    DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }

    log.Println("Database connected successfully")
}
```

## Models

### internal/models/user.go

```go
package models

import (
    "time"

    "gorm.io/gorm"
)

type User struct {
    ID        uint           `json:"id" gorm:"primaryKey"`
    Name      string         `json:"name" gorm:"not null"`
    Email     string         `json:"email" gorm:"uniqueIndex;not null"`
    Password  string         `json:"-" gorm:"not null"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type CreateUserInput struct {
    Name     string `json:"name" binding:"required,min=2,max=100"`
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
}

type UpdateUserInput struct {
    Name  string `json:"name" binding:"omitempty,min=2,max=100"`
    Email string `json:"email" binding:"omitempty,email"`
}
```

## Handlers

### internal/handlers/user.go

```go
package handlers

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/yourusername/go-api/internal/models"
    "github.com/yourusername/go-api/pkg/database"
    "golang.org/x/crypto/bcrypt"
)

// GetUsers returns all users
func GetUsers(c *gin.Context) {
    var users []models.User

    result := database.DB.Find(&users)
    if result.Error != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "data":  users,
        "count": len(users),
    })
}

// GetUser returns a single user by ID
func GetUser(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 32)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
        return
    }

    var user models.User
    result := database.DB.First(&user, id)
    if result.Error != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": user})
}

// CreateUser creates a new user
func CreateUser(c *gin.Context) {
    var input models.CreateUserInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Hash password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
        return
    }

    user := models.User{
        Name:     input.Name,
        Email:    input.Email,
        Password: string(hashedPassword),
    }

    result := database.DB.Create(&user)
    if result.Error != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
        return
    }

    c.JSON(http.StatusCreated, gin.H{"data": user})
}

// UpdateUser updates an existing user
func UpdateUser(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 32)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
        return
    }

    var user models.User
    if result := database.DB.First(&user, id); result.Error != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    var input models.UpdateUserInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    database.DB.Model(&user).Updates(input)
    c.JSON(http.StatusOK, gin.H{"data": user})
}

// DeleteUser deletes a user (soft delete)
func DeleteUser(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 32)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
        return
    }

    result := database.DB.Delete(&models.User{}, id)
    if result.RowsAffected == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
```

## Routes

### internal/routes/routes.go

```go
package routes

import (
    "github.com/gin-gonic/gin"
    "github.com/yourusername/go-api/internal/handlers"
)

func SetupRouter() *gin.Engine {
    r := gin.Default()

    // Health check
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    // API v1
    v1 := r.Group("/api/v1")
    {
        users := v1.Group("/users")
        {
            users.GET("", handlers.GetUsers)
            users.GET("/:id", handlers.GetUser)
            users.POST("", handlers.CreateUser)
            users.PUT("/:id", handlers.UpdateUser)
            users.DELETE("/:id", handlers.DeleteUser)
        }
    }

    return r
}
```

## Main Entry Point

### cmd/server/main.go

```go
package main

import (
    "log"
    "os"

    "github.com/joho/godotenv"
    "github.com/yourusername/go-api/internal/models"
    "github.com/yourusername/go-api/internal/routes"
    "github.com/yourusername/go-api/pkg/database"
)

func main() {
    // Load environment variables
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found")
    }

    // Connect to database
    database.Connect()

    // Auto migrate
    database.DB.AutoMigrate(&models.User{})

    // Setup router
    r := routes.SetupRouter()

    // Start server
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Server starting on port %s", port)
    r.Run(":" + port)
}
```

## Environment Variables

### .env

```env
PORT=8080
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=secret
DB_NAME=go_api
DB_PORT=5432
```

## Testing the API

```bash
# Create a user
curl -X POST http://localhost:8080/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'

# Get all users
curl http://localhost:8080/api/v1/users

# Get a specific user
curl http://localhost:8080/api/v1/users/1

# Update a user
curl -X PUT http://localhost:8080/api/v1/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated"}'

# Delete a user
curl -X DELETE http://localhost:8080/api/v1/users/1
```

## Conclusion

We've built a complete REST API with:

- CRUD operations for users
- PostgreSQL database with GORM
- Input validation
- Password hashing
- Soft deletes

Next steps to consider:
- Add JWT authentication
- Implement rate limiting
- Add request logging middleware
- Write unit and integration tests
