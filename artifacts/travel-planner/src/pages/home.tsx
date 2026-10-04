import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListRecentItineraries, useGetItineraryStats } from "@workspace/api-client-react";
import { Calendar, Wallet, Navigation, Sparkles, MapPin, Clock } from "lucide-react";

export default function Home() {
  const { data: recent, isLoading: isLoadingRecent } = useListRecentItineraries();
  const { data: stats } = useGetItineraryStats();

  return (
    <div className="flex flex-col w-full">

      {/* Hero */}
      <section className="relative h-[85vh] min-h-[580px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}hero-bg.png)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />

        <div className="relative z-10 container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 text-white/90 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Travel Planning
          </div>

          <h1 className="text-5xl md:text-[4.5rem] font-serif text-white font-semibold mb-6 leading-[1.1]">
            Your Dream Trip,<br />Planned in Seconds.
          </h1>

          <p className="text-lg md:text-xl text-white/85 mb-10 font-light max-w-xl mx-auto leading-relaxed">
            Tell us where you want to go. Our AI builds a complete day-by-day itinerary — with hotels, food, transport, and prices in ₹ — instantly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/itinerary/new">
              <Button size="lg" className="h-14 px-10 text-base font-serif bg-white text-primary hover:bg-white/95 rounded-none shadow-lg">
                Plan My Trip →
              </Button>
            </Link>
            <Link href="/itineraries">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base font-serif text-white border-white/60 hover:bg-white/15 rounded-none bg-transparent">
                Browse Journeys
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/40" />
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/40 border-y border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {[
              { step: "01", icon: <MapPin className="h-5 w-5" />, title: "Pick your destination", desc: "Enter where you want to go, how many days, and your budget." },
              { step: "02", icon: <Sparkles className="h-5 w-5" />, title: "AI builds your plan", desc: "Our AI creates a full itinerary with hotels, food spots, and day-by-day activities." },
              { step: "03", icon: <Clock className="h-5 w-5" />, title: "Book & go", desc: "Use the one-click booking links for flights, hotels, and tours — all in one place." },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="flex gap-5 px-8 py-8">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground/50 mb-1">{step}</p>
                  <h3 className="font-serif text-lg text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats + Recent */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">

          {/* Stats row */}
          {stats && stats.totalItineraries > 0 && (
            <div className="flex flex-wrap gap-10 mb-16 pb-16 border-b border-border">
              <div>
                <span className="text-5xl font-serif text-primary block leading-none mb-1">{stats.totalItineraries}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Trips Planned</span>
              </div>
              {stats.topDestinations[0] && (
                <div>
                  <span className="text-5xl font-serif text-primary block leading-none mb-1">#{stats.topDestinations[0].destination.split(",")[0]}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">Top Destination</span>
                </div>
              )}
              <div>
                <span className="text-5xl font-serif text-primary block leading-none mb-1">₹</span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">All prices in INR</span>
              </div>
            </div>
          )}

          {/* Recent itineraries */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Recently Planned</p>
              <h2 className="text-2xl font-serif text-foreground">Latest Journeys</h2>
            </div>
            <Link href="/itineraries" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {isLoadingRecent ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 bg-muted animate-pulse" />
              ))
            ) : recent && recent.length > 0 ? (
              recent.slice(0, 4).map((itinerary) => (
                <Link key={itinerary.id} href={`/itineraries/${itinerary.id}`}>
                  <div className="group relative border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col overflow-hidden">
                    {/* Colored top accent */}
                    <div className="h-1 w-full bg-gradient-to-r from-primary/60 to-primary" />

                    <div className="p-5 flex flex-col flex-1 justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2 block capitalize">
                          {itinerary.travelStyle}
                        </span>
                        <h4 className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors leading-tight mb-4">
                          {itinerary.destination}
                        </h4>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {itinerary.durationDays} days
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                          <Wallet className="w-3.5 h-3.5" />
                          <span className="capitalize">{itinerary.budget}</span>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        View itinerary <Navigation className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-4 text-center py-16 bg-muted/20 border border-dashed border-border">
                <p className="font-serif text-xl text-foreground/50 mb-2">No trips planned yet</p>
                <p className="text-sm text-muted-foreground mb-6">Be the first to plan an AI-powered journey</p>
                <Link href="/itinerary/new">
                  <Button variant="outline" className="font-serif rounded-none">Plan a Trip Now</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-serif mb-4 leading-tight">
            Ready to explore the world?
          </h2>
          <p className="text-primary-foreground/75 mb-8 text-lg font-light">
            Get a complete trip plan with hotels, food, transport & prices in ₹ — in under a minute.
          </p>
          <Link href="/itinerary/new">
            <Button size="lg" className="h-14 px-10 text-base font-serif bg-white text-primary hover:bg-white/90 rounded-none">
              Start Planning for Free →
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}
