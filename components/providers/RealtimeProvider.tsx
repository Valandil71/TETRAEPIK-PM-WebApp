"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
  useState,
} from "react";
import { useQueryClient, QueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/hooks/core/useSupabase";
import { getProjectListStatuses, queryKeys, type ProjectListStatus } from "@/lib/queryKeys";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import type { Query } from "@tanstack/react-query";
import type { ProjectWithTranslators } from "@/types/project";

type BroadcastEvent = "INSERT" | "UPDATE" | "DELETE";

/**
 * Shape of the broadcast message from realtime.broadcast_changes().
 * The outer object has { event, type, payload }.
 * payload contains { old_record, record, schema, table, type }.
 */
interface BroadcastMessage {
  event: string;
  type?: string;
  payload: {
    old_record: Record<string, unknown> | null;
    record: Record<string, unknown> | null;
    schema: string;
    table: string;
    type: string;
  };
  [key: string]: unknown;
}

interface RealtimeContextValue {
  isConnected: boolean;
  onImportReport: (callback: () => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  onImportReport: () => () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

interface RealtimeProviderProps {
  children: ReactNode;
}

// ─── Handlers (pure functions, no hooks) ─────────────────────────────────────

/** Project statuses a list query contains (see queryKeys.projectsWithTranslators). */
function getListStatuses(query: Query): string[] {
  return getProjectListStatuses(query.queryKey[3] as ProjectListStatus);
}

/**
 * Project lists are filtered by status, so a project change only affects the lists for its
 * old and new status. Skipping the rest avoids refetching the ~2,000-row completed list on
 * every change to an active project (and the active lists on invoicing updates).
 * Unknown statuses (unexpected payload) refresh every list.
 */
export function invalidateProjectListsForStatuses(
  queryClient: QueryClient,
  statuses: unknown[]
) {
  const known = statuses.filter((status) => typeof status === "string");
  const refreshAll = known.length === 0;
  queryClient.invalidateQueries({
    queryKey: queryKeys.projectsWithTranslators(),
    predicate: (query) =>
      refreshAll || getListStatuses(query).some((status) => known.includes(status)),
  });
}

/**
 * An assignment change only affects lists that contain its project. A list that has no data
 * yet or is mid-fetch is refreshed too, since it may be about to include the project.
 * Exported for tests.
 */
export function invalidateProjectListsForAssignment(
  queryClient: QueryClient,
  projectId: number | undefined
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.projectsWithTranslators(),
    predicate: (query) => {
      if (projectId === undefined || query.state.fetchStatus === "fetching") return true;
      const projects = query.state.data as ProjectWithTranslators[] | undefined;
      return !projects || projects.some((project) => project.id === projectId);
    },
  });
}

function handleProjectsChange(
  queryClient: QueryClient,
  eventType: BroadcastEvent,
  newRecord: Record<string, unknown>,
  oldRecord: Record<string, unknown>
) {
  const statuses = [newRecord?.status, oldRecord?.status];

  if (eventType === "INSERT" || eventType === "DELETE") {
    invalidateProjectListsForStatuses(queryClient, statuses);
    queryClient.invalidateQueries({ queryKey: queryKeys.homeManageProjectsCount() });
  }

  if (eventType === "UPDATE" && newRecord?.id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.project(newRecord.id as number) });
    invalidateProjectListsForStatuses(queryClient, statuses);
    // Instructions previews loaded per page (Concluded Projects, Invoicing)
    if (statuses.includes("complete")) {
      queryClient.invalidateQueries({ queryKey: queryKeys.sapInstructionPreviews() });
    }
    // A status change (e.g. marked complete) changes the home "Manage Projects" count
    queryClient.invalidateQueries({ queryKey: queryKeys.homeManageProjectsCount() });
  }

  if (eventType === "DELETE" && oldRecord?.id) {
    queryClient.removeQueries({ queryKey: queryKeys.project(oldRecord.id as number) });
  }
}

function handleAssignmentChange(
  queryClient: QueryClient,
  newRecord: Record<string, unknown>,
  oldRecord: Record<string, unknown>,
  currentUserId: string | null
) {
  const projectId = (newRecord?.project_id ?? oldRecord?.project_id) as number | undefined;
  const userId = (newRecord?.user_id ?? oldRecord?.user_id) as string | undefined;

  if (projectId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  }

  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
  }

  invalidateProjectListsForAssignment(queryClient, projectId);

  // Always invalidate the current user's cache regardless of payload contents.
  if (currentUserId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(currentUserId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(currentUserId) });
  }
}

function handleImportReportInsert(
  queryClient: QueryClient,
  listeners: Set<() => void>
) {
  queryClient.invalidateQueries({ queryKey: ["import-reports"] });
  queryClient.invalidateQueries({ queryKey: queryKeys.sapImportStatus() });
  listeners.forEach((cb) => cb());
}

function handleSapImportStatusChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.sapImportStatus() });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const importReportListenersRef = useRef<Set<() => void>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);

  // Cache current user ID (read from the local session: getUser would add a round trip that
  // also holds the auth lock, delaying every other Supabase request on page load)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      currentUserIdRef.current = data.session?.user.id ?? null;
    });
  }, [supabase]);

  const onImportReport = useCallback((callback: () => void) => {
    importReportListenersRef.current.add(callback);
    return () => {
      importReportListenersRef.current.delete(callback);
    };
  }, []);

  // Single stable effect — no callback dependencies
  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    function routeChange(msg: Record<string, unknown>) {
      const payload = msg.payload as BroadcastMessage["payload"] | undefined;

      if (!payload || !payload.table) {
        console.warn("[Realtime] Received broadcast with unexpected shape:", msg);
        return;
      }

      const eventType = (msg.event as string)?.toUpperCase() as BroadcastEvent;
      const record = payload.record ?? {};
      const oldRecord = payload.old_record ?? {};
      const qc = queryClient;

      console.debug(`[Realtime] ${eventType} on ${payload.table}`, { record, oldRecord });

      switch (payload.table) {
        case "projects":
          handleProjectsChange(qc, eventType, record, oldRecord);
          break;
        case "projects_assignment":
          handleAssignmentChange(qc, record, oldRecord, currentUserIdRef.current);
          break;
        case "import_reports":
          if (eventType === "INSERT") {
            handleImportReportInsert(qc, importReportListenersRef.current);
          }
          break;
        case "sap_import_status":
          handleSapImportStatusChange(qc);
          break;
        default:
          console.debug(`[Realtime] Ignoring event on unknown table: ${payload.table}`);
      }
    }

    async function setup() {
      // Ensure the realtime client has a valid auth token for private channels
      await supabase.realtime.setAuth();

      if (cancelled) return;

      channel = supabase
        .channel("db-changes", { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, routeChange)
        .on("broadcast", { event: "UPDATE" }, routeChange)
        .on("broadcast", { event: "DELETE" }, routeChange)
        .subscribe((status: string, err?: Error) => {
          console.debug(`[Realtime] Channel status: ${status}`, err ?? "");
          if (!cancelled) {
            setIsConnected(status === "SUBSCRIBED");
          }
        });

      channelRef.current = channel;
    }

    setup();

    return () => {
      cancelled = true;
      // Clean up both the ref and the local variable (covers race where
      // setup() hasn't finished writing to channelRef yet)
      const ch = channelRef.current ?? channel;
      if (ch) {
        supabase.removeChannel(ch);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [supabase, queryClient]); // Only depends on stable clients

  return (
    <RealtimeContext.Provider value={{ isConnected, onImportReport }}>
      {children}
    </RealtimeContext.Provider>
  );
}
