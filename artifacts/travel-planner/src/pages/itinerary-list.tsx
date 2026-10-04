import { Link } from "wouter";
import { useListItineraries, useDeleteItinerary, getListItinerariesQueryKey, getListRecentItinerariesQueryKey, getGetItineraryStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, Wallet, Trash2, Plus, MapPin } from "lucide-react";

const BUDGET_COLORS: Record<string, string> = {
  budget: "bg-emerald-100 text-emerald-700",
  "mid-range": "bg-sky-100 text-sky-700",
  luxury: "bg-amber-100 text-amber-700",
};

const STYLE_COLORS: Record<string, string> = {
  adventure: "bg-orange-100 text-orange-700",
  cultural: "bg-purple-100 text-purple-700",
  relaxation: "bg-teal-100 text-teal-700",
  foodie: "bg-red-100 text-red-700",
  family: "bg-blue-100 text-blue-700",
  romantic: "bg-pink-100 text-pink-700",
  backpacker: "bg-lime-100 text-lime-700",
};

export default function ItineraryList() {
  const { data: itineraries, isLoading } = useListItineraries();
  const deleteItinerary = useDeleteItinerary();
  const queryClient = useQueryClient();

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this itinerary?")) return;
    deleteItinerary.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListItinerariesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRecentItinerariesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetItineraryStatsQueryKey() });
        },
      }
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Archive</p>
          <h1 className="text-4xl font-serif text-foreground">My Journeys</h1>
        </div>
        <Link href="/itinerary/new">
          <Button data-testid="button-new-itinerary" className="font-serif rounded-none gap-2">
            <Plus className="h-4 w-4" />
            Plan a Trip
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-none" />
          ))}
        </div>
      ) : !itineraries || itineraries.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border">
          <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-serif text-2xl text-foreground/50 mb-2">No journeys yet</p>
          <p className="text-muted-foreground text-sm mb-6">Your curated travel itineraries will appear here</p>
          <Link href="/itinerary/new">
            <Button data-testid="button-start-planning" variant="outline" className="font-serif rounded-none">
              Start Planning
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {itineraries.map((itinerary) => (
            <Link key={itinerary.id} href={`/itineraries/${itinerary.id}`}>
              <div
                data-testid={`card-itinerary-${itinerary.id}`}
                className="group relative border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 p-8 cursor-pointer h-full flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <h2 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
                      {itinerary.destination}
                    </h2>
                    <button
                      data-testid={`button-delete-${itinerary.id}`}
                      onClick={(e) => handleDelete(e, itinerary.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${BUDGET_COLORS[itinerary.budget] ?? "bg-secondary text-secondary-foreground"}`}>
                      {itinerary.budget}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${STYLE_COLORS[itinerary.travelStyle] ?? "bg-secondary text-secondary-foreground"}`}>
                      {itinerary.travelStyle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-sm text-muted-foreground border-t border-border pt-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {itinerary.durationDays} days
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {itinerary.travelers} {itinerary.travelers === 1 ? "person" : "people"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground/60">
                    {new Date(itinerary.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
