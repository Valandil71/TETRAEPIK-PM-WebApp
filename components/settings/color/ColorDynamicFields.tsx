"use client";

import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { useSupabase } from "@/hooks/core/useSupabase";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ColorFormValues, Category } from "./ColorForm";

interface Props {
  category: string | Category;
  form: UseFormReturn<ColorFormValues>;
}

interface ProjectLanguageRow {
  language_in: string | null;
  language_out: string | null;
}

interface ProjectSystemRow {
  system: string | null;
}

export function ColorDynamicFields({ category, form }: Props) {
  const cat = (category || "system") as Category;
  const supabase = useSupabase();
  const [systemOptions, setSystemOptions] = useState<string[]>([]);
  const [languageInOptions, setLanguageInOptions] = useState<string[]>([]);
  const [languageOutOptions, setLanguageOutOptions] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      if (cat === "system") {
        const { data, error } = await supabase.from("projects").select("system");

        if (error) {
          console.error("Failed to load system options:", error);
          if (isMounted) setSystemOptions([]);
          return;
        }

        const rows = (data ?? []) as ProjectSystemRow[];
        const values = Array.from(
          new Set(
            rows
              .map((row) => row.system?.trim())
              .filter((value): value is string => Boolean(value))
          )
        ).sort((a, b) => a.localeCompare(b));

        if (isMounted) setSystemOptions(values);
        return;
      }

      if (cat === "language") {
        const { data, error } = await supabase
          .from("projects")
          .select("language_in, language_out");

        if (error) {
          console.error("Failed to load language options:", error);
          if (isMounted) {
            setLanguageInOptions([]);
            setLanguageOutOptions([]);
          }
          return;
        }

        const rows = (data ?? []) as ProjectLanguageRow[];

        const inValues = Array.from(
          new Set(
            rows
              .map((row) => row.language_in?.trim())
              .filter((value): value is string => Boolean(value))
          )
        ).sort((a, b) => a.localeCompare(b));

        const outValues = Array.from(
          new Set(
            rows
              .map((row) => row.language_out?.trim())
              .filter((value): value is string => Boolean(value))
          )
        ).sort((a, b) => a.localeCompare(b));

        if (isMounted) {
          setLanguageInOptions(inValues);
          setLanguageOutOptions(outValues);
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [cat, supabase]);

  if (cat === "system")
    return (
      <FormField
        control={form.control}
        name="system_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>System Name *</FormLabel>
            <FormControl>
              <Select
                onValueChange={(v) => field.onChange(v)}
                value={field.value ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a system" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {systemOptions.length > 0 ? (
                    systemOptions.map((system) => (
                      <SelectItem key={system} value={system}>
                        {system}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No systems found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );

  if (cat === "status")
    return (
      <FormField
        control={form.control}
        name="status_key"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status *</FormLabel>
            <FormControl>
              <Select
                onValueChange={(v) => field.onChange(v)}
                value={field.value ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );

  if (cat === "language")
    return (
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="language_in"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From (language) *</FormLabel>
              <FormControl>
                <Select
                  onValueChange={(v) => field.onChange(v)}
                  value={field.value ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {languageInOptions.length > 0 ? (
                      languageInOptions.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No source languages found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="language_out"
          render={({ field }) => (
            <FormItem>
              <FormLabel>To (language) *</FormLabel>
              <FormControl>
                <Select
                  onValueChange={(v) => field.onChange(v)}
                  value={field.value ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {languageOutOptions.length > 0 ? (
                      languageOutOptions.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No target languages found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );

  return null;
}
