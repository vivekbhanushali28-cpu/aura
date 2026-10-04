import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, MapPin, Send, Plane, ArrowRight } from "lucide-react";
import { getListItinerariesQueryKey, getListRecentItinerariesQueryKey, getGetItineraryStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  destination: z.string().min(2, "Enter a destination"),
  durationDays: z.coerce.number().min(1).max(30),
  budget: z.enum(["budget", "mid-range", "luxury"]),
  travelers: z.coerce.number().min(1).max(20),
  travelStyle: z.enum(["adventure", "cultural", "relaxation", "foodie", "family", "romantic", "backpacker"]),
  startDate: z.string().optional(),
  interests: z.string().optional(),
  specialRequirements: z.string().optional(),
  transportFrom: z.string().optional(),
  transportTo: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget — Smart savings" },
  { value: "mid-range", label: "Mid-Range — Comfort & value" },
  { value: "luxury", label: "Luxury — No compromises" },
] as const;

const STYLE_OPTIONS = [
  { value: "adventure", label: "Adventure" },
  { value: "cultural", label: "Cultural" },
  { value: "relaxation", label: "Relaxation" },
  { value: "foodie", label: "Foodie" },
  { value: "family", label: "Family" },
  { value: "romantic", label: "Romantic" },
  { value: "backpacker", label: "Backpacker" },
] as const;

export default function ItineraryGenerator() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destination: "",
      durationDays: 7,
      budget: "mid-range",
      travelers: 2,
      travelStyle: "cultural",
      startDate: "",
      interests: "",
      specialRequirements: "",
      transportFrom: "",
      transportTo: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsGenerating(true);
    setStreamedContent("");
    setError(null);

    const body = {
      destination: values.destination,
      durationDays: values.durationDays,
      budget: values.budget,
      travelers: values.travelers,
      travelStyle: values.travelStyle,
      startDate: values.startDate || null,
      interests: values.interests
        ? values.interests.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      specialRequirements: values.specialRequirements || null,
      transportFrom: values.transportFrom || null,
      transportTo: values.transportTo || null,
    };

    try {
      const response = await fetch("/api/itineraries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        setError("Failed to generate itinerary. Please try again.");
        setIsGenerating(false);
        return;
      }

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
            if (data.error) {
              setError(data.error);
              setIsGenerating(false);
              return;
            }
            if (data.content) {
              setStreamedContent((prev) => {
                const next = prev + data.content;
                setTimeout(() => {
                  if (contentRef.current) {
                    contentRef.current.scrollTop = contentRef.current.scrollHeight;
                  }
                }, 0);
                return next;
              });
            }
            if (data.done && data.itinerary) {
              await queryClient.invalidateQueries({ queryKey: getListItinerariesQueryKey() });
              await queryClient.invalidateQueries({ queryKey: getListRecentItinerariesQueryKey() });
              await queryClient.invalidateQueries({ queryKey: getGetItineraryStatsQueryKey() });
              setIsGenerating(false);
              setLocation(`/itineraries/${data.itinerary.id}`);
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  const hasStarted = streamedContent.length > 0 || isGenerating;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
      {/* Left: Form */}
      <div className={`${hasStarted ? "md:w-2/5 lg:w-1/3" : "w-full max-w-2xl mx-auto"} p-8 md:p-12 md:border-r border-border flex-shrink-0 transition-all duration-500 overflow-y-auto`}>
        <div className="mb-10">
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">Trip Planner</p>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground leading-tight">
            Design Your<br />Perfect Journey.
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Destination */}
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Destination</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Paris, France" className="pl-10 rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duration + Travelers */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Days</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={30} className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="travelers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Travelers</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={20} className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Budget */}
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Budget</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-none border-0 border-b focus:ring-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BUDGET_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Travel Style */}
            <FormField
              control={form.control}
              name="travelStyle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Travel Style</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-none border-0 border-b focus:ring-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Start Date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Interests */}
            <FormField
              control={form.control}
              name="interests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Interests (comma-separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="museums, hiking, street food..." className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Transport From/To */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4">
                <Plane className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Travel Route (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="transportFrom"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">From</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 flex-shrink-0" />
                <FormField
                  control={form.control}
                  name="transportTo"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">To</FormLabel>
                      <FormControl>
                        <Input placeholder="Same as destination" className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1.5">Fill in "From" to get intercity travel options, flight prices, and booking links</p>
            </div>

            {/* Special requirements */}
            <FormField
              control={form.control}
              name="specialRequirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Special Requirements (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Wheelchair accessible, vegetarian only, travelling with toddlers..." className="rounded-none border-0 border-b focus-visible:ring-0 focus-visible:border-primary bg-transparent resize-none" rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full h-12 rounded-none font-serif text-base mt-4"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Crafting Your Journey...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate Itinerary
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>

      {/* Right: Streaming output */}
      {hasStarted && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-8 md:px-12 py-6 border-b border-border bg-muted/20 flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse delay-100" />
              <span className="w-2 h-2 rounded-full bg-primary/80 animate-pulse delay-200" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {isGenerating ? "Your personal itinerary is being crafted..." : "Saving your itinerary..."}
            </span>
          </div>
          <div ref={contentRef} className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90 bg-transparent border-0 p-0 m-0">
              {streamedContent}
              {isGenerating && <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse align-middle" />}
            </pre>
          </div>
        </div>
      )}

      {!hasStarted && (
        <div className="hidden md:flex flex-1 items-center justify-center bg-muted/20 relative overflow-hidden">
          <div className="text-center px-8 max-w-lg">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Your itinerary will appear here</p>
            <p className="text-3xl font-serif text-foreground/40 leading-relaxed italic">
              "The world is a book, and those who do not travel read only one page."
            </p>
            <p className="mt-4 text-sm text-muted-foreground">— Saint Augustine</p>
          </div>
        </div>
      )}
    </div>
  );
}
