import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetItinerary,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  useDeleteItinerary,
  getGetItineraryQueryKey,
  getListItinerariesQueryKey,
  getListRecentItinerariesQueryKey,
  getGetItineraryStatsQueryKey,
  getGetOpenaiConversationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Send, Loader2, MessageSquare, Trash2,
  ChevronDown, ChevronUp, ExternalLink, Plane, Hotel,
  Utensils, Car, Globe, MapPin, Phone, Star, Train, Bus,
} from "lucide-react";
import { Link } from "wouter";

const SECTION_ICONS: Record<string, string> = {
  "Trip Summary": "01",
  "Getting There": "02",
  "Hotel Recommendations": "03",
  "Day-by-Day Itinerary": "04",
  "Food & Restaurant Guide": "05",
  "Transportation & Getting Around": "06",
  "Booking Recommendations": "07",
  "Estimated Budget Breakdown": "08",
  "Travel Tips & Safety": "09",
  "Emergency Contacts": "10",
};

function parseItinerarySections(content: string) {
  const sections: { title: string; body: string }[] = [];
  const lines = content.split("\n");
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      if (currentSection) {
        sections.push({ title: currentSection.title, body: currentSection.lines.join("\n").trim() });
      }
      currentSection = { title: h2Match[1].trim(), lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  if (currentSection && currentSection.lines.length > 0) {
    sections.push({ title: currentSection.title, body: currentSection.lines.join("\n").trim() });
  }
  return sections;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s,)[\]]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyPrefix}-t${last}`}>{text.slice(last, m.index)}</span>);
    if (m[1]) {
      nodes.push(<strong key={`${keyPrefix}-b${m.index}`} className="font-semibold text-foreground">{m[2]}</strong>);
    } else if (m[3]) {
      nodes.push(<em key={`${keyPrefix}-i${m.index}`}>{m[4]}</em>);
    } else if (m[5]) {
      nodes.push(
        <a key={`${keyPrefix}-l${m.index}`} href={m[7]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5 break-all">
          {m[6]}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
        </a>
      );
    } else if (m[8]) {
      nodes.push(
        <a key={`${keyPrefix}-u${m.index}`} href={m[8]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5 break-all">
          {m[8]}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
        </a>
      );
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(<span key={`${keyPrefix}-t${last}`}>{text.slice(last)}</span>);
  return nodes;
}

function renderBodyWithLinks(body: string) {
  const lines = body.split("\n");
  return lines.map((line, i) => {
    const key = `line-${i}`;
    const h4 = line.match(/^#{3,}\s+(.+)/);
    if (h4) {
      return (
        <p key={key} className="font-semibold text-foreground mt-4 mb-1 text-sm">
          {renderInline(h4[1], key)}
        </p>
      );
    }
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      return (
        <div key={key} className="flex gap-2 text-sm leading-relaxed text-foreground/90 ml-2">
          <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>
          <span>{renderInline(bullet[1], key)}</span>
        </div>
      );
    }
    if (line.trim() === "") return <div key={key} className="h-2" />;
    return (
      <p key={key} className="text-sm leading-relaxed text-foreground/90">
        {renderInline(line, key)}
      </p>
    );
  });
}

function SectionCard({ title, body, defaultOpen = true }: { title: string; body: string; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const num = SECTION_ICONS[title] ?? "—";

  return (
    <div className="border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-8 py-5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="font-mono text-xs text-muted-foreground/50 w-6 flex-shrink-0">{num}</span>
        <h2 className="font-serif text-xl text-foreground flex-1">{title}</h2>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-8 pb-8 pt-2 border-t border-border/50">
          <div className="space-y-0.5">
            {renderBodyWithLinks(body)}
          </div>
        </div>
      )}
    </div>
  );
}

type BookingLink = { label: string; url: string; icon: React.ReactNode; badge?: string };

type BookingCategory = {
  category: string;
  icon: React.ReactNode;
  color: string;
  links: BookingLink[];
};

const CITY_COORDS: Record<string, [number, number]> = {
  "mumbai": [19.076, 72.8777], "delhi": [28.6139, 77.209], "new delhi": [28.6139, 77.209],
  "bangalore": [12.9716, 77.5946], "bengaluru": [12.9716, 77.5946], "hyderabad": [17.385, 78.4867],
  "chennai": [13.0827, 80.2707], "kolkata": [22.5726, 88.3639], "pune": [18.5204, 73.8567],
  "ahmedabad": [23.0225, 72.5714], "jaipur": [26.9124, 75.7873], "surat": [21.1702, 72.8311],
  "lucknow": [26.8467, 80.9462], "kanpur": [26.4499, 80.3319], "nagpur": [21.1458, 79.0882],
  "indore": [22.7196, 75.8577], "thane": [19.2183, 72.9781], "bhopal": [23.2599, 77.4126],
  "visakhapatnam": [17.6868, 83.2185], "vizag": [17.6868, 83.2185], "patna": [25.5941, 85.1376],
  "vadodara": [22.3072, 73.1812], "ghaziabad": [28.6692, 77.4538], "ludhiana": [30.901, 75.8573],
  "agra": [27.1767, 78.0081], "nashik": [19.9975, 73.7898], "ranchi": [23.3441, 85.3096],
  "faridabad": [28.4089, 77.3178], "meerut": [28.9845, 77.7064], "rajkot": [22.3039, 70.8022],
  "varanasi": [25.3176, 82.9739], "srinagar": [34.0837, 74.7973], "amritsar": [31.634, 74.8723],
  "allahabad": [25.4358, 81.8463], "prayagraj": [25.4358, 81.8463], "howrah": [22.5958, 88.2636],
  "coimbatore": [11.0168, 76.9558], "jabalpur": [23.1815, 79.9864], "gwalior": [26.2183, 78.1828],
  "vijayawada": [16.5062, 80.648], "jodhpur": [26.2389, 73.0243], "madurai": [9.9252, 78.1198],
  "raipur": [21.2514, 81.6296], "kota": [25.2138, 75.8648], "chandigarh": [30.7333, 76.7794],
  "guwahati": [26.1445, 91.7362], "solapur": [17.6805, 75.9064], "hubli": [15.3647, 75.124],
  "mysuru": [12.2958, 76.6394], "mysore": [12.2958, 76.6394], "tiruchirappalli": [10.7905, 78.7047],
  "trichy": [10.7905, 78.7047], "thiruvananthapuram": [8.5241, 76.9366], "trivandrum": [8.5241, 76.9366],
  "kochi": [9.9312, 76.2673], "cochin": [9.9312, 76.2673], "bhubaneswar": [20.2961, 85.8245],
  "dehradun": [30.3165, 78.0322], "shimla": [31.1048, 77.1734], "manali": [32.2396, 77.1887],
  "leh": [34.1526, 77.5771], "goa": [15.2993, 74.124], "panaji": [15.4909, 73.8278],
  "udaipur": [24.5854, 73.7125], "pushkar": [26.489, 74.551], "rishikesh": [30.0869, 78.2676],
  "haridwar": [29.9457, 78.1642], "darjeeling": [27.0360, 88.2627], "ooty": [11.4102, 76.695],
  "munnar": [10.0889, 77.0595], "kerala": [10.8505, 76.2711], "kashmir": [34.0837, 74.7973],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lookupCoords(place: string): [number, number] | null {
  const key = place.toLowerCase().split(",")[0].trim();
  return CITY_COORDS[key] ?? null;
}

function estimateDistanceKm(from: string | null | undefined, to: string): number | null {
  if (!from) return null;
  const a = lookupCoords(from);
  const b = lookupCoords(to);
  if (!a || !b) return null;
  return haversineKm(a[0], a[1], b[0], b[1]);
}

function buildBookingCategories(
  destination: string,
  transportFrom: string | null | undefined,
  startDate: string | null | undefined,
  travelers: number,
): BookingCategory[] {
  const enc = encodeURIComponent(destination);
  const fromEnc = encodeURIComponent(transportFrom ?? destination);
  const city = destination.split(",")[0].trim();
  const cityEnc = encodeURIComponent(city);
  const checkin = startDate ?? "";

  const distKm = estimateDistanceKm(transportFrom, destination);
  const showFlights = distKm === null || distKm >= 500;

  const flightsCategory: BookingCategory = {
      category: "✈️ Flights",
      icon: <Plane className="h-3.5 w-3.5" />,
      color: "border-blue-200 bg-blue-50/50",
      links: [
        {
          label: "IndiGo",
          url: `https://www.goindigo.in/flight-booking.html`,
          icon: <Plane className="h-3 w-3" />,
          badge: "Budget",
        },
        {
          label: "Air India",
          url: `https://www.airindia.com/book-flight.htm`,
          icon: <Plane className="h-3 w-3" />,
          badge: "Full-service",
        },
        {
          label: "SpiceJet",
          url: `https://www.spicejet.com/`,
          icon: <Plane className="h-3 w-3" />,
          badge: "Budget",
        },
        {
          label: "Vistara (Air India Express)",
          url: `https://www.airindiaexpress.com/`,
          icon: <Plane className="h-3 w-3" />,
        },
        {
          label: "Compare on MakeMyTrip",
          url: `https://www.makemytrip.com/flights/`,
          icon: <Globe className="h-3 w-3" />,
          badge: "Compare",
        },
      ],
  };

  return [
    ...(showFlights ? [flightsCategory] : []),
    {
      category: "🚗 Road Transport",
      icon: <Car className="h-3.5 w-3.5" />,
      color: "border-amber-200 bg-amber-50/50",
      links: [
        {
          label: "Uber",
          url: `https://www.uber.com/in/en/ride/`,
          icon: <Car className="h-3 w-3" />,
          badge: "Cab",
        },
        {
          label: "Ola Cabs",
          url: `https://www.olacabs.com/`,
          icon: <Car className="h-3 w-3" />,
          badge: "Cab",
        },
        {
          label: "Rapido",
          url: `https://www.rapido.bike/`,
          icon: <Car className="h-3 w-3" />,
          badge: "Bike/Auto",
        },
        {
          label: "RedBus",
          url: `https://www.redbus.in/bus-tickets/search?fromCity=${fromEnc}&toCity=${cityEnc}`,
          icon: <Bus className="h-3 w-3" />,
          badge: "Bus",
        },
        {
          label: "IRCTC Trains",
          url: `https://www.irctc.co.in/nget/train-search`,
          icon: <Train className="h-3 w-3" />,
          badge: "Train",
        },
        {
          label: "Rome2rio",
          url: `https://www.rome2rio.com/s/${fromEnc}/${cityEnc}`,
          icon: <Globe className="h-3 w-3" />,
          badge: "All options",
        },
      ],
    },
    {
      category: "🏨 Hotels",
      icon: <Hotel className="h-3.5 w-3.5" />,
      color: "border-indigo-200 bg-indigo-50/50",
      links: [
        {
          label: "MakeMyTrip Hotels",
          url: `https://www.makemytrip.com/hotels/${city.toLowerCase().replace(/\s+/g, "-")}-hotels.html`,
          icon: <Hotel className="h-3 w-3" />,
          badge: "Popular",
        },
        {
          label: "OYO Rooms",
          url: `https://www.oyorooms.com/search/?location=${enc}`,
          icon: <Hotel className="h-3 w-3" />,
          badge: "Budget",
        },
        {
          label: "Booking.com",
          url: `https://www.booking.com/search.html?ss=${enc}${checkin ? `&checkin=${checkin}` : ""}&group_adults=${travelers}`,
          icon: <Hotel className="h-3 w-3" />,
        },
        {
          label: "Airbnb",
          url: `https://www.airbnb.com/s/${enc}/homes`,
          icon: <Globe className="h-3 w-3" />,
        },
      ],
    },
    {
      category: "🍽️ Food & Cafes",
      icon: <Utensils className="h-3.5 w-3.5" />,
      color: "border-rose-200 bg-rose-50/50",
      links: [
        {
          label: "Zomato",
          url: `https://www.zomato.com/search?q=${cityEnc}+restaurants`,
          icon: <Utensils className="h-3 w-3" />,
          badge: "Reviews",
        },
        {
          label: "Swiggy",
          url: `https://www.swiggy.com/`,
          icon: <Utensils className="h-3 w-3" />,
        },
        {
          label: "EazyDiner",
          url: `https://www.eazydiner.com/search?search=${cityEnc}`,
          icon: <Utensils className="h-3 w-3" />,
          badge: "Reservations",
        },
      ],
    },
    {
      category: "🗺️ Maps & Reviews",
      icon: <MapPin className="h-3.5 w-3.5" />,
      color: "border-green-200 bg-green-50/50",
      links: [
        {
          label: "Google Maps",
          url: `https://www.google.com/maps/search/?api=1&query=${enc}`,
          icon: <MapPin className="h-3 w-3" />,
          badge: "Reviews",
        },
        {
          label: "Google Hotels",
          url: `https://www.google.com/travel/hotels/${enc}`,
          icon: <Hotel className="h-3 w-3" />,
          badge: "Compare",
        },
        {
          label: "TripAdvisor",
          url: `https://www.tripadvisor.in/Search?q=${enc}`,
          icon: <Star className="h-3 w-3" />,
          badge: "Reviews",
        },
        {
          label: "Yelp",
          url: `https://www.yelp.com/search?find_desc=restaurants&find_loc=${enc}`,
          icon: <Star className="h-3 w-3" />,
        },
      ],
    },
    {
      category: "🎯 Activities",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "border-purple-200 bg-purple-50/50",
      links: [
        {
          label: "GetYourGuide",
          url: `https://www.getyourguide.com/s/?q=${enc}`,
          icon: <MapPin className="h-3 w-3" />,
        },
        {
          label: "Viator Tours",
          url: `https://www.viator.com/searchResults/all?text=${enc}`,
          icon: <Globe className="h-3 w-3" />,
        },
        {
          label: "Holidify",
          url: `https://www.holidify.com/places/${city.toLowerCase().replace(/\s+/g, "-")}/`,
          icon: <MapPin className="h-3 w-3" />,
          badge: "India",
        },
      ],
    },
  ];
}

export default function ItineraryDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: itinerary, isLoading } = useGetItinerary(id, {
    query: { enabled: !!id, queryKey: getGetItineraryQueryKey(id) },
  });

  const deleteItinerary = useDeleteItinerary();
  const createConversation = useCreateOpenaiConversation();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  const { data: conversation, refetch: refetchConversation } = useGetOpenaiConversation(
    conversationId ?? 0,
    { query: { enabled: !!conversationId, queryKey: getGetOpenaiConversationQueryKey(conversationId ?? 0) } }
  );

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, streamingContent]);

  async function openChat() {
    if (!conversationId) {
      const conv = await new Promise<{ id: number }>((resolve, reject) => {
        createConversation.mutate(
          { data: { title: `Chat about ${itinerary?.destination ?? "trip"}` } },
          { onSuccess: resolve, onError: reject }
        );
      });
      setConversationId(conv.id);
    }
    setChatOpen(true);
  }

  async function sendMessage() {
    if (!message.trim() || !conversationId || isStreaming) return;
    const text = message.trim();
    setMessage("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) setStreamingContent((p) => p + data.content);
            if (data.done) {
              setStreamingContent("");
              refetchConversation();
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      // silently handle
    } finally {
      setIsStreaming(false);
    }
  }

  function handleDelete() {
    if (!confirm("Delete this itinerary permanently?")) return;
    deleteItinerary.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListItinerariesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRecentItinerariesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetItineraryStatsQueryKey() });
          setLocation("/itineraries");
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="w-full h-64 rounded-none" />
        <div className="container mx-auto px-4 py-12 max-w-4xl space-y-6">
          <Skeleton className="h-8 w-48 rounded-none" />
          <Skeleton className="h-16 w-80 rounded-none" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="font-serif text-2xl text-muted-foreground">Itinerary not found</p>
        <Link href="/itineraries">
          <Button variant="outline" className="mt-4 rounded-none font-serif">Back to journeys</Button>
        </Link>
      </div>
    );
  }

  const sections = parseItinerarySections(itinerary.content);
  const bookingCategories = buildBookingCategories(
    itinerary.destination,
    itinerary.transportFrom,
    itinerary.startDate,
    itinerary.travelers,
  );
  const hasImage = !!itinerary.imageUrl && !imgError;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto ${chatOpen ? "md:max-w-[calc(100%-420px)]" : ""}`}>

        {/* Hero image */}
        {hasImage ? (
          <div className="relative w-full h-56 md:h-80 overflow-hidden bg-muted">
            <img
              src={itinerary.imageUrl!}
              alt={itinerary.destination}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <p className="text-white/70 text-xs uppercase tracking-widest mb-1">
                {itinerary.travelStyle} · {itinerary.budget} · {itinerary.travelers} {itinerary.travelers === 1 ? "traveler" : "travelers"}
              </p>
              <h1 className="text-3xl md:text-5xl font-serif text-white font-semibold leading-tight">
                {itinerary.destination}
              </h1>
              <p className="text-white/80 text-sm mt-1">
                {itinerary.durationDays}-day itinerary
                {itinerary.startDate ? ` · Starting ${itinerary.startDate}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-32 md:h-48 bg-primary overflow-hidden flex items-end">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
              backgroundSize: "20px 20px"
            }} />
            <div className="relative p-6 md:p-10">
              <p className="text-primary-foreground/70 text-xs uppercase tracking-widest mb-1">
                {itinerary.travelStyle} · {itinerary.budget} · {itinerary.travelers} {itinerary.travelers === 1 ? "traveler" : "travelers"}
              </p>
              <h1 className="text-3xl md:text-5xl font-serif text-primary-foreground font-semibold">
                {itinerary.destination}
              </h1>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-8 max-w-4xl">

          {/* Top action bar */}
          <div className="flex items-center justify-between mb-8 gap-4">
            <Link href="/itineraries" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              All Journeys
            </Link>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openChat}
                className="rounded-none font-serif gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Ask AI
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Transport route badge */}
          {itinerary.transportFrom && (
            <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-muted/50 border border-border text-sm">
              <Plane className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Route:</span>
              <span className="font-medium text-foreground">{itinerary.transportFrom}</span>
              <ArrowLeft className="h-3 w-3 text-muted-foreground rotate-180" />
              <span className="font-medium text-foreground">{itinerary.transportTo ?? itinerary.destination}</span>
            </div>
          )}

          {/* Quick Booking Panel */}
          <div className="mb-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Book Your Trip</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bookingCategories.map((cat) => (
                <div key={cat.category} className={`border rounded-lg p-4 ${cat.color}`}>
                  <p className="text-xs font-semibold text-foreground/70 mb-3 tracking-wide">{cat.category}</p>
                  <div className="space-y-1.5">
                    {cat.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/80 hover:bg-white border border-white/60 hover:border-border transition-all group text-sm"
                      >
                        <span className="flex items-center gap-2 text-foreground font-medium truncate">
                          {link.icon}
                          {link.label}
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {link.badge && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none">
                              {link.badge}
                            </span>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sections */}
          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((section, i) => (
                <SectionCard key={section.title} title={section.title} body={section.body} defaultOpen={i < 2} />
              ))}
            </div>
          ) : (
            <div className="prose prose-neutral max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90 bg-transparent border-0 p-0 m-0">
                {renderBodyWithLinks(itinerary.content)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat panel */}
      {chatOpen && (
        <div className="w-full md:w-[420px] flex-shrink-0 border-t md:border-t-0 md:border-l border-border flex flex-col h-[60vh] md:h-auto md:sticky md:top-16 md:max-h-[calc(100vh-64px)]">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <span className="font-serif text-base">Ask About Your Trip</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatOpen(false)}
              className="text-muted-foreground text-xs"
            >
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!conversation?.messages?.length && !isStreaming && (
              <div className="text-sm text-muted-foreground text-center py-8">
                <Phone className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="italic font-serif mb-2">Ask Aura anything about this trip</p>
                <p className="text-xs opacity-70">Hotel alternatives · restaurant tips · route changes · local contacts · budget adjustments</p>
              </div>
            )}
            {conversation?.messages?.map((msg) => (
              <div
                key={msg.id}
                className={`text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-primary text-primary-foreground px-4 py-3 ml-8"
                  : "bg-muted/50 text-foreground px-4 py-3 mr-8"
                }`}
              >
                <p className="text-xs uppercase tracking-wider opacity-60 mb-1">{msg.role === "user" ? "You" : "Aura AI"}</p>
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              </div>
            ))}
            {isStreaming && streamingContent && (
              <div className="bg-muted/50 text-foreground px-4 py-3 mr-8 text-sm">
                <p className="text-xs uppercase tracking-wider opacity-60 mb-1">Aura AI</p>
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {streamingContent}
                  <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                </pre>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-border flex gap-2 items-end">
            <Textarea
              placeholder="Ask about hotels, contact numbers, cheaper options..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              className="resize-none rounded-none border-0 border-b focus-visible:ring-0 bg-transparent text-sm flex-1"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isStreaming || !message.trim()}
              className="rounded-none self-end h-10 w-10"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
