import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WidgetId, WidgetPreferences } from "@shared/schema";
import { defaultWidgetPreferences } from "@shared/schema";

export type { WidgetId, WidgetPreferences };

export function useWidgetPreferences() {
  const { data: prefs, isLoading } = useQuery<WidgetPreferences>({
    queryKey: ["/api/user/preferences"],
    staleTime: Infinity,
    placeholderData: defaultWidgetPreferences,
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<WidgetPreferences>) =>
      apiRequest("PATCH", "/api/user/preferences", updates),
    onMutate: async (updates) => {
      // Optimistic update
      const previous = queryClient.getQueryData<WidgetPreferences>(["/api/user/preferences"]);
      queryClient.setQueryData(["/api/user/preferences"], { ...(previous ?? defaultWidgetPreferences), ...updates });
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user/preferences"], data);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/user/preferences"], ctx.previous);
    },
  });

  const toggleWidget = (id: WidgetId) => {
    const current = prefs ?? defaultWidgetPreferences;
    mutation.mutate({ [id]: !current[id] });
  };

  return { prefs: prefs ?? defaultWidgetPreferences, isLoading, toggleWidget };
}
