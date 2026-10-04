import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, itinerariesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  GetItineraryParams,
  DeleteItineraryParams,
  GenerateItineraryBody,
  CreateItineraryBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function fetchDestinationImage(destination: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(destination)}&prop=pageimages&format=json&pithumbsize=1200&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

const TRAVEL_SYSTEM_PROMPT = `You are an intelligent AI Travel Planner Agent — a premium human travel consultant.

Your task is to create highly personalized, practical, and optimized travel itineraries.

Your responsibilities include:
1. Understand user travel preferences deeply.
2. Recommend hotels based on: budget, safety, nearby attractions, transport convenience, and ratings.
3. Suggest attractions and hidden gems.
4. Optimize routes to reduce travel time and fatigue.
5. Create a day-by-day schedule.
6. Balance activities with rest time.
7. Recommend local food and cafes.
8. Suggest transportation methods.
9. Keep the itinerary realistic and achievable.
10. Avoid overcrowding the schedule.

Rules:
- Prioritize user comfort and experience.
- Keep plans geographically optimized.
- Recommend morning, afternoon, and evening activities separately.
- Consider weather, traffic, and opening timings.
- Suggest both budget-friendly and premium options when possible.
- Always provide estimated costs in Indian Rupees (₹ INR). Use ₹ symbol before amounts (e.g. ₹5,000/night, ₹15,000 total).
- Keep responses structured and easy to read using Markdown.
- Use bullet points and tables whenever helpful.
- Never recommend impossible travel timing.
- If the user budget is low, intelligently reduce costs without ruining the experience.

IMPORTANT — Always embed these real working links inside the itinerary text:

HOTELS (for every hotel recommendation include all 3 links):
- Google Maps + Reviews: [View on Google Maps & Reviews](https://www.google.com/maps/search/?api=1&query=HOTEL_NAME+DESTINATION)
- MakeMyTrip: [Book on MakeMyTrip](https://www.makemytrip.com/hotels/hotel_listing.html?city=DESTINATION&roomCount=1)
- OYO Rooms: [Book on OYO](https://www.oyorooms.com/search/?location=DESTINATION)
- Also include real phone number and nightly rate in ₹.

RESTAURANTS & CAFES (for every food recommendation include both links):
- Google Maps + Reviews: [View on Google Maps & Reviews](https://www.google.com/maps/search/?api=1&query=RESTAURANT_NAME+DESTINATION)
- Zomato: [Order/View on Zomato](https://www.zomato.com/search?q=RESTAURANT_NAME+DESTINATION)

FLIGHTS (in Getting There and Transport sections):
- IndiGo: [Book on IndiGo](https://www.goindigo.in/flight-booking.html)
- Air India: [Book on Air India](https://www.airindia.com/book-flight.htm)
- SpiceJet: [Book on SpiceJet](https://www.spicejet.com/)
- MakeMyTrip Flights: [Search on MakeMyTrip](https://www.makemytrip.com/flights/)
- For all routes show estimated price in ₹ and duration.

ROAD TRANSPORT (in Transport sections):
- Uber: [Book Uber Cab](https://www.uber.com/in/en/ride/)
- Ola: [Book Ola Cab](https://www.olacabs.com/)
- RedBus (for intercity buses): [Book on RedBus](https://www.redbus.in/)
- IRCTC (for trains): [Book Train on IRCTC](https://www.irctc.co.in/nget/train-search)
- Rapido (for bike/auto): [Book on Rapido](https://www.rapido.bike/)

ACTIVITIES & ATTRACTIONS (for every attraction):
- Google Maps: [View on Google Maps](https://www.google.com/maps/search/?api=1&query=ATTRACTION_NAME+DESTINATION)

Output Format (use these EXACT Markdown headings — do not add or omit any):
## Trip Summary
## Getting There
## Hotel Recommendations
## Day-by-Day Itinerary
## Food & Restaurant Guide
## Transportation & Getting Around
## Booking Recommendations
## Estimated Budget Breakdown
## Travel Tips & Safety
## Emergency Contacts`;

router.get("/itineraries", async (req, res): Promise<void> => {
  const itineraries = await db
    .select()
    .from(itinerariesTable)
    .orderBy(desc(itinerariesTable.createdAt));
  res.json(itineraries);
});

router.get("/itineraries/recent", async (req, res): Promise<void> => {
  const itineraries = await db
    .select()
    .from(itinerariesTable)
    .orderBy(desc(itinerariesTable.createdAt))
    .limit(5);
  res.json(itineraries);
});

router.get("/itineraries/stats", async (req, res): Promise<void> => {
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itinerariesTable);

  const topDestinations = await db
    .select({
      destination: itinerariesTable.destination,
      count: sql<number>`count(*)::int`,
    })
    .from(itinerariesTable)
    .groupBy(itinerariesTable.destination)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const budgetCounts = await db
    .select({
      budget: itinerariesTable.budget,
      count: sql<number>`count(*)::int`,
    })
    .from(itinerariesTable)
    .groupBy(itinerariesTable.budget);

  const popularStyles = await db
    .select({
      style: itinerariesTable.travelStyle,
      count: sql<number>`count(*)::int`,
    })
    .from(itinerariesTable)
    .groupBy(itinerariesTable.travelStyle)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const budgetBreakdown = {
    budget: budgetCounts.find((b) => b.budget === "budget")?.count ?? 0,
    midRange: budgetCounts.find((b) => b.budget === "mid-range")?.count ?? 0,
    luxury: budgetCounts.find((b) => b.budget === "luxury")?.count ?? 0,
  };

  res.json({
    totalItineraries: total[0]?.count ?? 0,
    topDestinations,
    budgetBreakdown,
    popularStyles,
  });
});

router.post("/itineraries/generate", async (req, res): Promise<void> => {
  const parsed = GenerateItineraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const prefs = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Start image fetch in parallel with AI generation
  const imagePromise = fetchDestinationImage(prefs.destination);

  const transportSection = prefs.transportFrom
    ? `\nOrigin / Departure city: ${prefs.transportFrom}
Destination city: ${prefs.transportTo ?? prefs.destination}
Please include a detailed "## Getting There" section covering how to travel from ${prefs.transportFrom} to ${prefs.destination}, with flight/train/bus options, estimated prices, booking links, and travel duration.`
    : "";

  const userMessage = `Plan a ${prefs.durationDays}-day trip to ${prefs.destination} for ${prefs.travelers} traveler(s).
Budget level: ${prefs.budget}
Travel style: ${prefs.travelStyle}
${prefs.startDate ? `Start date: ${prefs.startDate}` : ""}
${prefs.interests && prefs.interests.length > 0 ? `Interests: ${prefs.interests.join(", ")}` : ""}
${prefs.specialRequirements ? `Special requirements: ${prefs.specialRequirements}` : ""}${transportSection}

For each hotel recommendation please include:
- Real hotel name and star rating
- Official website URL
- Phone number (real or representative)
- Approximate nightly rate for the given budget
- Booking.com or Hotels.com link for this hotel

For each restaurant include: name, address, phone number, price range ($ to $$$$), and a Google Maps link.

In "## Booking Recommendations" include direct links:
- Flights: https://www.google.com/flights?q=flights+to+${encodeURIComponent(prefs.destination)}
- Hotels: https://www.booking.com/search.html?ss=${encodeURIComponent(prefs.destination)}
- Airbnb: https://www.airbnb.com/s/${encodeURIComponent(prefs.destination)}/homes
- Activities: https://www.getyourguide.com/s/?q=${encodeURIComponent(prefs.destination)}
- Tours: https://www.viator.com/searchResults/all?text=${encodeURIComponent(prefs.destination)}
- Transport: https://www.rome2rio.com/s/${encodeURIComponent(prefs.transportFrom ?? "your+city")}/${encodeURIComponent(prefs.destination)}

Please create a comprehensive, personalized travel itinerary following the structured output format.`;

  let fullContent = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: TRAVEL_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    const imageUrl = await imagePromise;

    const [saved] = await db
      .insert(itinerariesTable)
      .values({
        destination: prefs.destination,
        durationDays: prefs.durationDays,
        budget: prefs.budget,
        travelers: prefs.travelers,
        travelStyle: prefs.travelStyle,
        startDate: prefs.startDate ?? null,
        interests: prefs.interests && prefs.interests.length > 0
          ? JSON.stringify(prefs.interests)
          : null,
        specialRequirements: prefs.specialRequirements ?? null,
        transportFrom: prefs.transportFrom ?? null,
        transportTo: prefs.transportTo ?? null,
        imageUrl,
        content: fullContent,
      })
      .returning();

    res.write(`data: ${JSON.stringify({ done: true, itinerary: saved })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error generating itinerary");
    res.write(`data: ${JSON.stringify({ error: "Failed to generate itinerary" })}\n\n`);
    res.end();
  }
});

router.post("/itineraries", async (req, res): Promise<void> => {
  const parsed = CreateItineraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [itinerary] = await db
    .insert(itinerariesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(itinerary);
});

router.get("/itineraries/:id", async (req, res): Promise<void> => {
  const params = GetItineraryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [itinerary] = await db
    .select()
    .from(itinerariesTable)
    .where(eq(itinerariesTable.id, params.data.id));

  if (!itinerary) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json(itinerary);
});

router.delete("/itineraries/:id", async (req, res): Promise<void> => {
  const params = DeleteItineraryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(itinerariesTable)
    .where(eq(itinerariesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
