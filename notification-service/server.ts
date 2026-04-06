import "dotenv/config";
import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] });

// ── Ensure topic exists ───────────────────────────────────────────────────────

const admin = kafka.admin();
await admin.connect();
await admin.createTopics({
  waitForLeaders: true,
  topics: [{ topic: "order.placed", numPartitions: 1, replicationFactor: 1 }],
});
await admin.disconnect();

// ── Consume ───────────────────────────────────────────────────────────────────

const consumer = kafka.consumer({ groupId: "notification-service" });

await consumer.connect();
console.log("Kafka consumer connected");

await consumer.subscribe({ topic: "order.placed", fromBeginning: false });

await consumer.run({
  eachMessage: async ({ message }) => {
    const data = JSON.parse(message.value!.toString());
    console.log(`[notification] New order placed — orderId: ${data.orderId}, userId: ${data.userId}, total: ${data.total}`);
  },
});
