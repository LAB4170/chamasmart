# ============================================================================
# ROOT DOCKERFILE – delegates to the backend multi‑stage Dockerfile
# ============================================================================

# Stage 1: Build the application using Maven (paths adjusted for repo root)
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build

# Copy pom.xml from the backend folder and download dependencies to cache them
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B

# Copy the source code from the backend folder and build the executable JAR
COPY backend/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Create the minimal production runtime image
FROM eclipse-temurin:17-jre-alpine AS runtime
WORKDIR /app

# Add a non‑root user for enhanced container security
RUN addgroup -S chamagroup && adduser -S chamauser -G chamagroup
USER chamauser:chamagroup

# Copy the built JAR from the build stage
COPY --from=build /build/target/*.jar app.jar

# Expose the production port
EXPOSE 5006

# Define environment variables with default fallbacks (overridden at runtime)
ENV PORT=5006 SPRING_PROFILES_ACTIVE=prod JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/jdk.internal.misc=ALL-UNNAMED"

# Execute the Spring Boot application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
