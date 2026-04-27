import "dotenv/config";
import { Kafka } from "kafkajs";
import logger from "./logger.ts";

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] });

// ── Ensure topic exists ───────────────────────────────────────────────────────

const admin = kafka.admin();
await admin.connect();
await admin.createTopics({
  waitForLeaders: true,
  topics: [{ topic: "order.placed", numPartitions: 1, replicationFactor: 1 }],
});
await admin.disconnect();
logger.info("Kafka topic ready", { topic: "order.placed" });

// ── Consume ───────────────────────────────────────────────────────────────────

const consumer = kafka.consumer({ groupId: "notification-service" });

await consumer.connect();
logger.info("Kafka consumer connected");

await consumer.subscribe({ topic: "order.placed", fromBeginning: false });

await consumer.run({
  eachMessage: async ({ message }) => {
    const data = JSON.parse(message.value!.toString());
    logger.info("notification received - new order placed", {
      orderId: data.orderId,
      userId: data.userId,
      total: data.total,
    });
  },
});
