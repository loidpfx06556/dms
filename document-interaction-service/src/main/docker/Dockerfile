FROM amazoncorretto:17-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src src
RUN apk add --no-cache maven
RUN mvn clean package -DskipTests

FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8085
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/app.jar"]