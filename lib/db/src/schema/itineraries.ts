import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itinerariesTable = pgTable("itineraries", {
  id: serial("id").primaryKey(),
  destination: text("destination").notNull(),
  durationDays: integer("duration_days").notNull(),
  budget: text("budget").notNull(),
  travelers: integer("travelers").notNull(),
  travelStyle: text("travel_style").notNull(),
  startDate: text("start_date"),
  interests: text("interests"),
  specialRequirements: text("special_requirements"),
  transportFrom: text("transport_from"),
  transportTo: text("transport_to"),
  imageUrl: text("image_url"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertItinerarySchema = createInsertSchema(itinerariesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertItinerary = z.infer<typeof insertItinerarySchema>;
export type Itinerary = typeof itinerariesTable.$inferSelect;
