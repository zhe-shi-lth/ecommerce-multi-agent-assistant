# 多阶段构建：Maven 编译 -> JRE 运行
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
# 先拷 pom 利用依赖缓存层
COPY pom.xml .
RUN mvn -B -q dependency:resolve
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre
# 安装 curl 供 compose 健康检查使用
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
